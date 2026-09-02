import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { StudentService } from "@/modules/students/application/student-service";
import {
  studentDirectoryQuerySchema,
  studentMutationSchema,
} from "@/modules/students/domain/student-contracts";
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
      { error: "Invalid student input", issues: error.issues },
      { status: 400 },
    );
  const conflicts = new Set([
    "Possible duplicate student found",
    "No active enrolment exists",
    "Academic year, campus, and section are required",
    "Student admission numbering is not configured",
  ]);
  if (error instanceof Error && conflicts.has(error.message))
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(
    { error: "Student operation could not be completed" },
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
    const url = new URL(request.url);
    const query = studentDirectoryQuerySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    return NextResponse.json(
      await new StudentService(prisma).directory(context, query),
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
    const input = await parseRequestBody(request, studentMutationSchema);
    return NextResponse.json(
      await new StudentService(prisma).mutate(
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
