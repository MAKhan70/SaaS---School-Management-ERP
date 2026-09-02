import { NextResponse } from "next/server";

import { SupabaseFunctionInviteDelivery } from "@/modules/platform-admin/application/invite-delivery";
import { PlatformAdminService } from "@/modules/platform-admin/application/platform-admin-service";
import { clientProvisionSchema } from "@/modules/platform-admin/domain/platform-admin-contracts";
import {
  requestMetadata,
  hasTrustedMutationOrigin,
} from "@/modules/identity/domain/request-security";
import { currentSession } from "@/server/auth/session";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody } from "@/server/http/request-body";

export async function GET() {
  const context = await currentSession();
  if (!context) return new NextResponse(null, { status: 401 });
  try {
    const clients = await new PlatformAdminService(prisma).listClients(context);
    return NextResponse.json(
      { clients },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return new NextResponse(null, { status: 403 });
  }
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  const context = await currentSession();
  if (!context) return new NextResponse(null, { status: 401 });
  try {
    const input = await parseRequestBody(request, clientProvisionSchema);
    const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
    const result = await new PlatformAdminService(
      prisma,
      new SupabaseFunctionInviteDelivery(),
    ).provisionClient(context, input, requestMetadata(request.headers), origin);
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Client could not be provisioned" },
      { status: 400 },
    );
  }
}
