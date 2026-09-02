import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { FeeService } from "@/modules/fees/application/fee-service";
import { feeMutationSchema } from "@/modules/fees/domain/fee-contracts";
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
      { error: "Invalid fee input", issues: error.issues },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    [
      "A different user must approve a fee adjustment",
      "A different user must approve a refund",
      "The idempotency key was already used for different payment data",
      "Payment allocations must equal the payment amount",
      "Payment allocations contain duplicate fee assignments",
      "A payment allocation is outside the active tenant or student account",
      "A payment allocation exceeds the outstanding amount",
      "The payment is already reversed",
      "Refunds cannot exceed the posted payment",
      "The provider event identifier has conflicting payload data",
    ].includes(error.message)
  )
    return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(
    { error: "Fee operation could not be completed" },
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
      await new FeeService(prisma).workspace(
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
    const input = await parseRequestBody(request, feeMutationSchema);
    return NextResponse.json(
      await new FeeService(prisma).mutate(
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
