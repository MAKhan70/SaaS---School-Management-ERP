import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Dashboard } from "@/components/dashboard";
import { DashboardQueryService } from "@/modules/dashboards/application/dashboard-query-service";
import { dashboardQuerySchema } from "@/modules/dashboards/domain/dashboard-contracts";
import { AuthorizationError } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";
import { prisma } from "@/server/database/prisma";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSession();
  try {
    const raw = await searchParams;
    const query = dashboardQuerySchema.parse(
      Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : value,
        ]),
      ),
    );
    const model = await new DashboardQueryService(prisma).getDashboard(
      context,
      query,
    );
    return (
      <>
        <Breadcrumbs current="Overview" />
        <Dashboard model={model} />
      </>
    );
  } catch (error) {
    if (error instanceof AuthorizationError) redirect("/access-denied");
    throw error;
  }
}
