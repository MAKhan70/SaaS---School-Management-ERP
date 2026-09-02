import { PublicAdmissionForm } from "@/components/public-admission-form";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ publicKey: string }>;
}) {
  return <PublicAdmissionForm publicKey={(await params).publicKey} />;
}
