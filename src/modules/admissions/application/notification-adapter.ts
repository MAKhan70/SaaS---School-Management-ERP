import type { AdmissionNotificationChannel, Prisma } from "@/generated/prisma";

export interface AdmissionNotificationAdapter {
  preview(
    tx: Prisma.TransactionClient,
    input: {
      trustId: string;
      schoolId: string;
      applicationId: string;
      channel: AdmissionNotificationChannel;
      recipient: string;
      templateKey: "admission.offer" | "admission.rejection";
    },
  ): Promise<void>;
}

function maskRecipient(value: string): string {
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${name?.slice(0, 2) ?? "**"}***@${domain ?? "***"}`;
  }
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export class LocalPreviewAdmissionNotificationAdapter implements AdmissionNotificationAdapter {
  async preview(
    tx: Prisma.TransactionClient,
    input: Parameters<AdmissionNotificationAdapter["preview"]>[1],
  ): Promise<void> {
    await tx.admissionNotificationPreview.create({
      data: {
        trustId: input.trustId,
        schoolId: input.schoolId,
        applicationId: input.applicationId,
        channel: input.channel,
        templateKey: input.templateKey,
        recipientMasked: maskRecipient(input.recipient),
        payload: {
          applicationId: input.applicationId,
          templateKey: input.templateKey,
        },
      },
    });
  }
}
