import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AttendanceService } from "@/modules/attendance/application/attendance-service";
import { attendanceMutationSchema } from "@/modules/attendance/domain/attendance-contracts";
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
      { error: "Invalid attendance input", issues: error.issues },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    [
      "Attendance session is locked",
      "Teacher is not assigned to this section",
      "A correction reason is required",
      "A correction reason is required for a previous day",
      "Only a locked attendance session can be reopened",
      "A reopening request requires a different approver",
      "A correction request requires a different approver",
      "Attendance contains a learner outside the section roster",
      "An attendance status is invalid or inactive",
    ].includes(error.message)
  )
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(
    { error: "Attendance operation could not be completed" },
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
      await new AttendanceService(prisma).workspace(
        context,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
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
    const input = await parseRequestBody(request, attendanceMutationSchema);
    return NextResponse.json(
      await new AttendanceService(prisma).mutate(
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
