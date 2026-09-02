import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTokenFromHeaders,
} from "@/server/auth/session";
import { prisma } from "@/server/database/prisma";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  const token = sessionTokenFromHeaders(request.headers);
  await new AuthenticationService(prisma).signOut(
    token,
    requestMetadata(request.headers),
  );
  const response = NextResponse.redirect(new URL("/sign-in", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
  response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return response;
}
