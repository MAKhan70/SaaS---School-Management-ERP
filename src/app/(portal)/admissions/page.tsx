import { redirect } from "next/navigation";

import { AdmissionsCrm } from "@/components/admissions-crm";
import { requireSession } from "@/server/auth/session";
import { authorize } from "@/server/authorization/authorize";

export default async function AdmissionsPage() {
  const context = await requireSession("/admissions");
  if (
    !authorize(context, "admissions.crm.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <AdmissionsCrm />;
}
