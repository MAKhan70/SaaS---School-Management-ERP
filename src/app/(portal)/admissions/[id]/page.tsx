import { redirect } from "next/navigation";

import { AdmissionDetail } from "@/components/admission-detail";
import { requireSession } from "@/server/auth/session";
import { authorize } from "@/server/authorization/authorize";

export default async function AdmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireSession("/admissions");
  if (
    !authorize(context, "admissions.crm.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
    }).allowed
  )
    redirect("/access-denied");
  return <AdmissionDetail applicationId={(await params).id} />;
}
