import { NextResponse } from "next/server";

import { AdmissionService } from "@/modules/admissions/application/admission-service";
import { AuthenticationService } from "@/modules/identity/application/auth-service";
import { AuthorizationError } from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)nasaq_session=([^;]+)/)?.[1];
  const context = await new AuthenticationService(prisma).authenticateSession(
    token,
  );
  if (!context)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  try {
    return NextResponse.json(
      await new AdmissionService(prisma).detail(context, (await params).id),
    );
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 },
    );
  }
}
