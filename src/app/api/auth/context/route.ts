import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import { switchContextSchema } from "@/modules/identity/domain/auth-contracts";
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
    const input = await parseRequestBody(request, switchContextSchema);
    const context = await new AuthenticationService(prisma).switchContext(
      token,
      input,
      requestMetadata(request.headers),
    );
    return context
      ? NextResponse.json({ context })
      : new NextResponse(null, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid context" }, { status: 400 });
  }
}
