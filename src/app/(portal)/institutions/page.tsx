import { redirect } from "next/navigation";

import { InstitutionAdmin } from "@/components/institution-admin";
import { authorize } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";

export default async function InstitutionsPage() {
  const context = await requireSession("/institutions");
  const decision = authorize(context, "institutions.school.manage", {
    trustId: context.trustId,
    schoolId: context.schoolId,
    ...(context.campusId ? { campusId: context.campusId } : {}),
  });
  if (!decision.allowed) redirect("/access-denied");
  return <InstitutionAdmin />;
}
