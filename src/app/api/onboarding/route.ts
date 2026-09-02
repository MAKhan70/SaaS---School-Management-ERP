import { NextResponse } from "next/server";

import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { TenantOnboardingService } from "@/modules/onboarding/application/onboarding-service";
import { tenantOnboardingSchema } from "@/modules/onboarding/domain/onboarding-contracts";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody, wantsJson } from "@/server/http/request-body";

export async function POST(request: Request) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PUBLIC_ONBOARDING !== "true"
  )
    return new NextResponse(null, { status: 404 });
  if (!hasTrustedMutationOrigin(request.headers))
    return new NextResponse(null, { status: 403 });
  try {
    const raw = await parseRequestBody(request, tenantOnboardingSchema);
    const result = await new TenantOnboardingService(prisma).complete(
      raw,
      requestMetadata(request.headers),
    );
    return wantsJson(request)
      ? NextResponse.json(result, { status: 201 })
      : NextResponse.redirect(
          new URL("/sign-in?onboarded=true", request.url),
          303,
        );
  } catch (error) {
    if (error instanceof Error && error.message.includes("rate limit"))
      return NextResponse.json(
        { error: "Please wait before trying again" },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    return wantsJson(request)
      ? NextResponse.json(
          { error: "Onboarding could not be completed" },
          { status: 400 },
        )
      : NextResponse.redirect(
          new URL("/onboarding?error=invalid", request.url),
          303,
        );
  }
}
