import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { resetPasswordSchema } from "@/modules/identity/domain/auth-contracts";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody, wantsJson } from "@/server/http/request-body";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  try {
    const input = await parseRequestBody(request, resetPasswordSchema);
    const reset = await new AuthenticationService(prisma).resetPassword(
      input,
      requestMetadata(request.headers),
    );
    if (!reset) throw new Error("invalid token");
    return wantsJson(request)
      ? NextResponse.json({ reset: true })
      : NextResponse.redirect(new URL("/sign-in?reset=true", request.url), 303);
  } catch {
    return wantsJson(request)
      ? NextResponse.json(
          { error: "The reset link is invalid or expired" },
          { status: 400 },
        )
      : NextResponse.redirect(
          new URL("/reset-password?error=invalid", request.url),
          303,
        );
  }
}
