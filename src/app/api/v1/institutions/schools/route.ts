import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  AuthorizationError,
  requirePermission,
} from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";
import { withTenant } from "@/server/database/tenant-context";

export async function GET(request: Request) {
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

  const requestedId = new URL(request.url).searchParams.get("id");
  try {
    requirePermission(context, "institutions.school.manage", {
      trustId: context.trustId,
      schoolId: requestedId ?? context.schoolId,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    throw error;
  }

  const schools = await withTenant(
    prisma,
    {
      trustId: context.trustId,
      actorUserId: context.userId,
      correlationId:
        request.headers.get("x-correlation-id") ?? crypto.randomUUID(),
    },
    (transaction) =>
      transaction.school.findMany({
        where: {
          trustId: context.trustId,
          ...(requestedId ? { id: requestedId } : {}),
        },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      }),
  );
  if (requestedId && schools.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ schools });
}
