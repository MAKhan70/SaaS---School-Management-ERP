import { NextResponse } from "next/server";
import { z } from "zod";

import {
  csvTemplate,
  importTemplateColumns,
} from "@/modules/academic-structure/domain/school-setup-contracts";
import { AuthenticationService } from "@/modules/identity/application/auth-service";
import { requirePermission } from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";

const kindSchema = z.enum(
  Object.keys(importTemplateColumns) as [
    keyof typeof importTemplateColumns,
    ...(keyof typeof importTemplateColumns)[],
  ],
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
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
  const parsed = kindSchema.safeParse((await params).kind);
  if (!parsed.success)
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  try {
    requirePermission(context, "academic.structure.manage", {
      trustId: context.trustId,
      schoolId: context.schoolId,
    });
  } catch {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return new NextResponse(csvTemplate(parsed.data), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${parsed.data}-import-template.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
