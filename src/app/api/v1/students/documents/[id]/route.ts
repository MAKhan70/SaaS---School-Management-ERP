import { AuditOutcome } from "@/generated/prisma";
import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import { requestMetadata } from "@/modules/identity/domain/request-security";
import {
  AuthorizationError,
  requirePermission,
} from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";
import { withTenant } from "@/server/database/tenant-context";

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
    requirePermission(context, "students.documents.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    });
    const { id } = await params;
    const metadata = requestMetadata(request.headers);
    const document = await withTenant(
      prisma,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (tx) => {
        const row = await tx.studentDocument.findFirstOrThrow({
          where: {
            id,
            trustId: context.trustId,
            schoolId: context.schoolId,
            ...(context.campusId ? { campusId: context.campusId } : {}),
            status: "AVAILABLE",
          },
          select: { id: true, studentProfileId: true },
        });
        await tx.auditEvent.create({
          data: {
            trustId: context.trustId,
            schoolId: context.schoolId,
            actorUserId: context.userId,
            effectiveActorUserId: context.userId,
            action: "student.document.download.request",
            resourceType: "StudentDocument",
            resourceId: row.id,
            outcome: AuditOutcome.SUCCEEDED,
            sensitivity: "RESTRICTED",
            correlationId: metadata.correlationId,
          },
        });
        return row;
      },
    );
    return NextResponse.json(
      {
        error: "Document storage adapter is not configured",
        documentId: document.id,
      },
      { status: 501 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}
