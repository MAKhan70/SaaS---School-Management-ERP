import { redirect } from "next/navigation";

import { FeeWorkspace } from "@/components/fee-workspace";
import { requireSession } from "@/server/auth/session";
import { authorize } from "@/server/authorization/authorize";

export default async function FeesPage() {
  const context = await requireSession("/fees");
  if (
    !authorize(context, "finance.fees.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <FeeWorkspace />;
}
