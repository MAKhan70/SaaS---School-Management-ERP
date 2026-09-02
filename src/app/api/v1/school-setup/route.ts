import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { SchoolSetupService } from "@/modules/academic-structure/application/school-setup-service";
import { schoolSetupMutationSchema } from "@/modules/academic-structure/domain/school-setup-contracts";
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
      { error: "Invalid school setup input", issues: error.issues },
      { status: 400 },
    );
  const safeConflictMessages = new Set([
    "The end date must follow the start date",
    "An active academic year already overlaps these dates",
    "Term dates must fall inside the academic year",
    "Period end must follow its start",
    "Calendar date must fall inside the academic year",
    "Grade requires a board and level",
    "A grading band has an invalid range",
    "Grading bands must not overlap",
    "Resource is outside active trust",
    "Resource is outside active school",
    "Resource is outside active campus",
  ]);
  if (error instanceof Error && safeConflictMessages.has(error.message))
    return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error)
    return NextResponse.json(
      { error: "Configuration conflicts with an existing record" },
      { status: 409 },
    );
  return NextResponse.json(
    { error: "School setup could not be completed" },
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
      await new SchoolSetupService(prisma).overview(context),
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
    const input = await parseRequestBody(request, schoolSetupMutationSchema);
    const result = await new SchoolSetupService(prisma).mutate(
      context,
      input,
      requestMetadata(request.headers),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
