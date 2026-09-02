import { redirect } from "next/navigation";
import { StudentProfile } from "@/components/student-profile";
import { authorize } from "@/server/authorization/authorize";
import { requireSession } from "@/server/auth/session";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireSession(`/students/${id}`);
  if (
    !authorize(context, "students.profile.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    }).allowed
  )
    redirect("/access-denied");
  return <StudentProfile studentId={id} />;
}
