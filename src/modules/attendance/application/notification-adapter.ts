import type { Prisma } from "@/generated/prisma";

export interface AttendanceNotification {
  trustId: string;
  schoolId: string;
  studentProfileId: string;
  attendanceRecordId?: string;
  templateKey: string;
  recipient: string;
  payload: Record<string, string | number | boolean | null>;
}

export interface AttendanceNotificationAdapter {
  queue(
    transaction: Prisma.TransactionClient,
    notification: AttendanceNotification,
  ): Promise<void>;
}

function maskRecipient(recipient: string): string {
  if (recipient.includes("@")) {
    const [local = "", domain = ""] = recipient.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `${recipient.slice(0, 2)}******${recipient.slice(-2)}`;
}

export class LocalAttendanceNotificationAdapter implements AttendanceNotificationAdapter {
  async queue(
    transaction: Prisma.TransactionClient,
    notification: AttendanceNotification,
  ): Promise<void> {
    await transaction.attendanceNotificationPreview.create({
      data: {
        trustId: notification.trustId,
        schoolId: notification.schoolId,
        studentProfileId: notification.studentProfileId,
        attendanceRecordId: notification.attendanceRecordId,
        channel: "IN_APP",
        templateKey: notification.templateKey,
        recipientMasked: maskRecipient(notification.recipient),
        payload: notification.payload,
      },
    });
  }
}
