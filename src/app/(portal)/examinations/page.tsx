import { redirect } from "next/navigation";

import { ExaminationWorkspace } from "@/components/examination-workspace";
import { requireSession } from "@/server/auth/session";
import { authorize } from "@/server/authorization/authorize";

export default async function ExaminationsPage() {
  const context = await requireSession("/examinations");
  if (
    !authorize(context, "assessments.workspace.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <ExaminationWorkspace />;
}
