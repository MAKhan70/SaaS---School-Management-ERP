import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "nasaq-web",
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
