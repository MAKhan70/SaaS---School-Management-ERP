import { NextResponse } from "next/server";
import { AuditOutcome, AuditSensitivity } from "@/generated/prisma";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  requirePermission,
  AuthorizationError,
} from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";
import { withTenant } from "@/server/database/tenant-context";
import { requestMetadata } from "@/modules/identity/domain/request-security";

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
    requirePermission(context, "admissions.documents.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
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
        const row = await tx.admissionDocument.findFirst({
          where: { id, trustId: context.trustId, schoolId: context.schoolId },
          select: { id: true, storageKey: true },
        });
        if (row)
          await tx.auditEvent.create({
            data: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              campusId: context.campusId,
              actorUserId: context.userId,
              effectiveActorUserId: context.userId,
              action: "admissions.document.download.request",
              resourceType: "AdmissionDocument",
              resourceId: row.id,
              outcome: AuditOutcome.SUCCEEDED,
              sensitivity: AuditSensitivity.RESTRICTED,
              correlationId: metadata.correlationId,
            },
          });
        return row;
      },
    );
    if (!document)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    return NextResponse.json(
      { error: "Private object storage is not configured" },
      { status: 501 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    throw error;
  }
}
