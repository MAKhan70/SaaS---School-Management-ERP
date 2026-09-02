import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import { forgotPasswordSchema } from "@/modules/identity/domain/auth-contracts";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody, wantsJson } from "@/server/http/request-body";

const genericMessage =
  "If an eligible account matches that address, password reset instructions will be sent.";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  try {
    const input = await parseRequestBody(request, forgotPasswordSchema);
    await new AuthenticationService(prisma).requestPasswordReset(
      input,
      requestMetadata(request.headers),
    );
  } catch {
    // Recovery responses intentionally do not distinguish invalid or unknown addresses.
  }
  return wantsJson(request)
    ? NextResponse.json({ message: genericMessage }, { status: 202 })
    : NextResponse.redirect(
        new URL("/forgot-password?submitted=true", request.url),
        303,
      );
}
