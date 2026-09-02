import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AiAssistanceService } from "@/modules/ai-assistance/application/ai-assistance-service";
import { aiAssistanceMutationSchema } from "@/modules/ai-assistance/domain/ai-contracts";
import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { AuthorizationError } from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody } from "@/server/http/request-body";

async function contextFrom(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)nasaq_session=([^;]+)/)?.[1];
  return new AuthenticationService(prisma).authenticateSession(token);
}

function failure(error: unknown) {
  if (error instanceof AuthorizationError)
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Invalid assistance request", issues: error.issues },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    [
      "Assistance draft was not found",
      "Support indicator was not found",
    ].includes(error.message)
  )
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  if (
    error instanceof Error &&
    [
      "Assistance draft was already reviewed",
      "Corrected factors are required for a correction",
      "Assistance output attempted to make a prohibited decision",
      "External AI providers are disabled outside production",
    ].includes(error.message)
  )
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(
    { error: "Assistance operation could not be completed" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const context = await contextFrom(request);
  if (!context)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  try {
    return NextResponse.json(
      await new AiAssistanceService(prisma).workspace(context),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return NextResponse.json({ error: "Untrusted request" }, { status: 403 });
  const context = await contextFrom(request);
  if (!context)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  try {
    const input = await parseRequestBody(request, aiAssistanceMutationSchema);
    return NextResponse.json(
      await new AiAssistanceService(prisma).mutate(
        context,
        input,
        requestMetadata(request.headers),
      ),
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
