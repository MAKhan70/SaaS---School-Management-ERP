export type JobKind =
  "notification.send" | "import.process" | "report.generate" | "schedule.run";

export interface JobEnvelope<TPayload extends Record<string, unknown>> {
  idempotencyKey: string;
  kind: JobKind;
  schemaVersion: 1;
  trustId: string;
  correlationId: string;
  payload: TPayload;
}

export interface JobQueue {
  enqueue<TPayload extends Record<string, unknown>>(
    job: JobEnvelope<TPayload>,
  ): Promise<void>;
}
