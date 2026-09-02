import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { OperationalService } from "@/modules/operations/application/operational-service";
import { operationalMutationSchema } from "@/modules/operations/domain/operational-contracts";
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
      { error: "Invalid operational input", issues: error.issues },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    [
      "Operational module was not found",
      "Operational record was not found",
    ].includes(error.message)
  )
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  if (
    error instanceof Error &&
    [
      "Record type is not valid for this module",
      "Sensitive operational details require a dedicated encrypted workflow",
      "Assignee is outside the active school scope",
      "Operational state transition is not allowed",
      "Operational record was changed by another user",
    ].includes(error.message)
  )
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(
    { error: "Operational request could not be completed" },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  const context = await contextFrom(request);
  if (!context)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  try {
    const { module } = await params;
    return NextResponse.json(
      await new OperationalService(prisma).workspace(
        context,
        module,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  if (!hasTrustedMutationOrigin(request.headers))
    return NextResponse.json({ error: "Untrusted request" }, { status: 403 });
  const context = await contextFrom(request);
  if (!context)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  try {
    const { module } = await params;
    const input = await parseRequestBody(request, operationalMutationSchema);
    return NextResponse.json(
      await new OperationalService(prisma).mutate(
        context,
        module,
        input,
        requestMetadata(request.headers),
      ),
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
