import { NextResponse } from "next/server";

import {
  requestMetadata,
  hasTrustedMutationOrigin,
} from "@/modules/identity/domain/request-security";
import { PlatformAdminService } from "@/modules/platform-admin/application/platform-admin-service";
import { featureUpdateSchema } from "@/modules/platform-admin/domain/platform-admin-contracts";
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
    const input = await parseRequestBody(request, featureUpdateSchema);
    await new PlatformAdminService(prisma).updateFeatures(
      context,
      id,
      input,
      requestMetadata(request.headers),
    );
    return NextResponse.json({ updated: true });
  } catch {
    return NextResponse.json(
      { error: "Features could not be updated" },
      { status: 400 },
    );
  }
}
