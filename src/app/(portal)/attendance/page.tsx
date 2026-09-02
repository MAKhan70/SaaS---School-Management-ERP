import { redirect } from "next/navigation";

import { AttendanceWorkspace } from "@/components/attendance-workspace";
import { requireSession } from "@/server/auth/session";
import { authorize } from "@/server/authorization/authorize";

export default async function AttendancePage() {
  const context = await requireSession("/attendance");
  if (
    !authorize(context, "attendance.session.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <AttendanceWorkspace />;
}
