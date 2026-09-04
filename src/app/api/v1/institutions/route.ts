import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { SchoolSetupService } from "@/modules/academic-structure/application/school-setup-service";
import { institutionProfileMutationSchema } from "@/modules/academic-structure/domain/school-setup-contracts";
import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { InstitutionService } from "@/modules/institutions/application/institution-service";
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
      { error: "Invalid institution profile input", issues: error.issues },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    [
      "Resource is outside active trust",
      "Resource is outside active school",
      "Resource is outside active campus",
    ].includes(error.message)
  )
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(
    { error: "Institution profiles could not be processed" },
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
    const response = NextResponse.json(
      await new InstitutionService(prisma).overview(context),
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
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
    const input = await parseRequestBody(
      request,
      institutionProfileMutationSchema,
    );
    return NextResponse.json(
      await new SchoolSetupService(prisma).mutate(
        context,
        input,
        requestMetadata(request.headers),
      ),
      { status: 200 },
    );
  } catch (error) {
    return failure(error);
  }
}
