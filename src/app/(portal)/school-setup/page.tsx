import { redirect } from "next/navigation";

import { SchoolSetupAdmin } from "@/components/school-setup-admin";
import { authorize } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";

export default async function SchoolSetupPage() {
  const context = await requireSession("/school-setup");
  const decision = authorize(context, "academic.structure.manage", {
    trustId: context.trustId,
    schoolId: context.schoolId,
  });
  if (!decision.allowed) redirect("/access-denied");
  return <SchoolSetupAdmin />;
}
