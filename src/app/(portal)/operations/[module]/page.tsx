import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { OperationalWorkspace } from "@/components/operational-workspace";
import { operationalModule } from "@/modules/operations/domain/operational-catalogue";
import { authorize } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";

export default async function OperationalModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const definition = operationalModule(module);
  if (!definition) notFound();
  const context = await requireSession(`/operations/${module}`);
  if (
    !authorize(context, definition.readPermission, {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return (
    <>
      <Breadcrumbs current={definition.title} />
      <OperationalWorkspace module={module} />
    </>
  );
}
