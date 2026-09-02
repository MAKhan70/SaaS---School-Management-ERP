import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { OperationalDirectory } from "@/components/operational-directory";
import { visibleOperationalModules } from "@/modules/operations/domain/operational-catalogue";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Operational modules" };

export default async function OperationsPage() {
  const context = await requireSession("/operations");
  return (
    <>
      <Breadcrumbs current="Operations" />
      <OperationalDirectory
        modules={visibleOperationalModules(context.permissionKeys)}
      />
    </>
  );
}
