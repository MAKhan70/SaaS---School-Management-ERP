import { NextResponse } from "next/server";

import { assertProductionEnv } from "@/lib/env";
import { prisma } from "@/server/database/prisma";
import { captureError } from "@/server/observability/error-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertProductionEnv(process.env);
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ready", service: "nasaq-web" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await captureError(error, { event: "readiness.database_unavailable" });
    return NextResponse.json(
      { status: "not_ready", service: "nasaq-web" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
