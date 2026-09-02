import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalyticsWorkspace } from "@/components/analytics-workspace";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AiAssistanceService } from "@/modules/ai-assistance/application/ai-assistance-service";
import { AnalyticsService } from "@/modules/analytics/application/analytics-service";
import { analyticsQuerySchema } from "@/modules/analytics/domain/analytics-contracts";
import { requireSession } from "@/server/auth/session";
import { AuthorizationError } from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";

export const metadata: Metadata = { title: "Analytics and assisted drafting" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSession();
  try {
    const raw = await searchParams;
    const query = analyticsQuerySchema.parse(
      Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : value,
        ]),
      ),
    );
    const [model, assistance] = await Promise.all([
      new AnalyticsService(prisma).dashboard(context, query),
      new AiAssistanceService(prisma).workspace(context),
    ]);
    return (
      <>
        <Breadcrumbs current="Analytics" />
        <AnalyticsWorkspace model={model} assistance={assistance} />
      </>
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/access-denied");
    throw error;
  }
}
