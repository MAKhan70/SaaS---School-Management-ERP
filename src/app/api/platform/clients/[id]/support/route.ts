import { NextResponse } from "next/server";

import {
  requestMetadata,
  hasTrustedMutationOrigin,
} from "@/modules/identity/domain/request-security";
import { PlatformAdminService } from "@/modules/platform-admin/application/platform-admin-service";
import { supportAccessSchema } from "@/modules/platform-admin/domain/platform-admin-contracts";
import { currentSession } from "@/server/auth/session";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody } from "@/server/http/request-body";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  const context = await currentSession();
  if (!context) return new NextResponse(null, { status: 401 });
  try {
    const { id } = await params;
    const input = await parseRequestBody(request, supportAccessSchema);
    const result = await new PlatformAdminService(prisma).beginSupportAccess(
      context,
      id,
      input,
      requestMetadata(request.headers),
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Support access could not be started" },
      { status: 400 },
    );
  }
}
