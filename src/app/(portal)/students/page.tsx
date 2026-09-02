import { redirect } from "next/navigation";
import { StudentDirectory } from "@/components/student-directory";
import { authorize } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";

export default async function StudentsPage() {
  const context = await requireSession("/students");
  if (
    !authorize(context, "students.profile.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <StudentDirectory />;
}
