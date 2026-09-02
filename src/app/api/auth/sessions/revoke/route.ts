import { z } from "zod";
import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody } from "@/server/http/request-body";
import { sessionTokenFromHeaders } from "@/server/auth/session";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  const token = sessionTokenFromHeaders(request.headers);
  if (!token) return new NextResponse(null, { status: 401 });
  try {
    const input = await parseRequestBody(
      request,
      z.object({ sessionId: z.string().min(1).max(64) }),
    );
    const revoked = await new AuthenticationService(prisma).revokeSession(
      token,
      input.sessionId,
      requestMetadata(request.headers),
    );
    return revoked
      ? new NextResponse(null, { status: 204 })
      : new NextResponse(null, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
