import { NextResponse } from "next/server";

import {
  requestMetadata,
  hasTrustedMutationOrigin,
} from "@/modules/identity/domain/request-security";
import { InvitationAcceptanceService } from "@/modules/platform-admin/application/invitation-acceptance-service";
import { invitationAcceptanceSchema } from "@/modules/platform-admin/domain/platform-admin-contracts";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody, wantsJson } from "@/server/http/request-body";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  try {
    const input = await parseRequestBody(request, invitationAcceptanceSchema);
    await new InvitationAcceptanceService(prisma).accept(
      input,
      requestMetadata(request.headers),
    );
    return wantsJson(request)
      ? NextResponse.json({ activated: true })
      : NextResponse.redirect(
          new URL("/sign-in?activated=true", request.url),
          303,
        );
  } catch {
    return wantsJson(request)
      ? NextResponse.json(
          { error: "Invitation is invalid or expired" },
          { status: 400 },
        )
      : NextResponse.redirect(
          new URL("/activate-account?error=invalid", request.url),
          303,
        );
  }
}
