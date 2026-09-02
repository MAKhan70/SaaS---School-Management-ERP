import type { Prisma } from "@/generated/prisma";

export interface ReportCardPdfAdapter {
  queue(input: {
    generationId: string;
    verificationCode: string;
    snapshot: Prisma.JsonObject;
  }): Promise<{ state: "QUEUED"; storageKey: null }>;
}

export class LocalReportCardPdfAdapter implements ReportCardPdfAdapter {
  async queue() {
    return { state: "QUEUED" as const, storageKey: null };
  }
}
