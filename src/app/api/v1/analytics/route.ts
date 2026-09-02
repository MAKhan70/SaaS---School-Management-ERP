import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuditOutcome, AuditSensitivity } from "@/generated/prisma";

import { AnalyticsService } from "@/modules/analytics/application/analytics-service";
import {
  analyticsCsv,
  analyticsQuerySchema,
} from "@/modules/analytics/domain/analytics-contracts";
import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  AuthorizationError,
  requirePermission,
} from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";
import { withTenant } from "@/server/database/tenant-context";
import { requestMetadata } from "@/modules/identity/domain/request-security";

async function contextFrom(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)nasaq_session=([^;]+)/)?.[1];
  return new AuthenticationService(prisma).authenticateSession(token);
}

export async function GET(request: Request) {
  const context = await contextFrom(request);
  if (!context)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  try {
    const query = analyticsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (query.format === "csv")
      requirePermission(context, "analytics.data.export", {
        trustId: context.trustId,
        schoolId: query.schoolId ?? context.schoolId,
        campusId: query.campusId,
      });
    const model = await new AnalyticsService(prisma).dashboard(context, query);
    if (query.format === "csv") {
      const metadata = requestMetadata(request.headers);
      await withTenant(
        prisma,
        {
          trustId: context.trustId,
          actorUserId: context.userId,
          correlationId: metadata.correlationId,
        },
        (transaction) =>
          transaction.auditEvent.create({
            data: {
              trustId: context.trustId,
              schoolId: model.scope.schoolId,
              campusId: model.scope.campusId,
              actorUserId: context.userId,
              effectiveActorUserId: context.userId,
              action: "analytics.export",
              resourceType: "Analytics",
              resourceId: query.metric ?? "all",
              outcome: AuditOutcome.SUCCEEDED,
              sensitivity: AuditSensitivity.SENSITIVE,
              correlationId: metadata.correlationId,
              metadata: { format: "csv", metric: query.metric ?? "all" },
            },
          }),
      );
      return new NextResponse(analyticsCsv(model, query.metric), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="school-analytics.csv"',
          "cache-control": "private, no-store",
        },
      });
    }
    return NextResponse.json(model, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid analytics filters", issues: error.issues },
        { status: 400 },
      );
    return NextResponse.json(
      { error: "Analytics could not be generated" },
      { status: 500 },
    );
  }
}
