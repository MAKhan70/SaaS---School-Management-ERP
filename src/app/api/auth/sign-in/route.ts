import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  safeReturnUrl,
  signInSchema,
} from "@/modules/identity/domain/auth-contracts";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody, wantsJson } from "@/server/http/request-body";
import { sameOriginRedirect } from "@/server/http/same-origin-redirect";
import { log } from "@/server/observability/logger";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers)) {
    return NextResponse.json(
      { error: "Request origin is not allowed" },
      { status: 403 },
    );
  }
  try {
    const input = await parseRequestBody(request, signInSchema);
    const metadata = requestMetadata(request.headers);
    const result = await new AuthenticationService(prisma).signIn(
      input,
      metadata,
    );
    if (!result.ok) {
      log("warn", "auth.sign_in_denied", {
        reasonCode: result.reason,
        correlationId: metadata.correlationId,
      });
      const status = result.reason === "RATE_LIMITED" ? 429 : 401;
      if (wantsJson(request))
        return NextResponse.json(
          { error: "Invalid email or password" },
          {
            status,
            headers:
              status === 429 ? { "Retry-After": String(15 * 60) } : undefined,
          },
        );
      return sameOriginRedirect(
        `/sign-in?error=invalid&returnUrl=${encodeURIComponent(safeReturnUrl(input.returnUrl))}`,
      );
    }
    const response = wantsJson(request)
      ? NextResponse.json({ context: result.context })
      : sameOriginRedirect(safeReturnUrl(input.returnUrl));
    response.cookies.set(
      SESSION_COOKIE,
      result.sessionToken,
      sessionCookieOptions(
        new Date(Date.now() + 8 * 60 * 60 * 1000),
        request.headers,
      ),
    );
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
