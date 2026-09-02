import { redirect } from "next/navigation";
import { StudentCreateForm } from "@/components/student-create-form";
import { authorize } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";

export default async function NewStudentPage() {
  const context = await requireSession("/students/new");
  if (
    !authorize(context, "students.profile.write", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <StudentCreateForm />;
}
