import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AuthenticationService,
  type AuthenticatedContext,
} from "@/modules/identity/application/auth-service";
import { prisma } from "@/server/database/prisma";

export const SESSION_COOKIE = "nasaq_session";

export function sessionCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export function sessionTokenFromHeaders(headers: Headers): string | undefined {
  const cookie = headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export async function currentSession(): Promise<AuthenticatedContext | null> {
  const store = await cookies();
  return new AuthenticationService(prisma).authenticateSession(
    store.get(SESSION_COOKIE)?.value,
  );
}

export async function requireSession(
  returnUrl = "/dashboard",
): Promise<AuthenticatedContext> {
  const session = await currentSession();
  if (!session) redirect(`/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`);
  return session;
}
