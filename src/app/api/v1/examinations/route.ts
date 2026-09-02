import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ExaminationService } from "@/modules/examinations/application/examination-service";
import { examinationMutationSchema } from "@/modules/examinations/domain/examination-contracts";
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
      { error: "Invalid examination input", issues: error.issues },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    [
      "Teacher is not assigned to this subject and section",
      "The marks register is locked",
      "Approved marks must be locked or reopened before editing",
      "A reason is required for every post-lock change",
      "A marks submission contains duplicate learner components",
      "A marks component is outside this examination subject",
      "A learner is outside the examination section roster",
      "Marks exceed the configured maximum",
      "Every learner component must be entered before approval",
      "Only a locked marks register can be reopened",
      "A different user must approve reopening",
      "A different user must approve moderation",
      "Reopen the locked register before moderation",
      "All marks registers must be locked before calculation",
      "Every component requires a mark, absent, or exempt status",
      "The examination calculation rule is invalid",
      "No calculated results are available to publish",
      "Only published results can be generated",
    ].includes(error.message)
  )
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(
    { error: "Examination operation could not be completed" },
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
      await new ExaminationService(prisma).workspace(
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
    const input = await parseRequestBody(request, examinationMutationSchema);
    return NextResponse.json(
      await new ExaminationService(prisma).mutate(
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
