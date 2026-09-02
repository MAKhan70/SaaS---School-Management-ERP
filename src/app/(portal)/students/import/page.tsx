import { redirect } from "next/navigation";
import { StudentImport } from "@/components/student-import";
import { authorize } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";

export default async function ImportStudentsPage() {
  const context = await requireSession("/students/import");
  if (
    !authorize(context, "students.bulk.import", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <StudentImport />;
}
