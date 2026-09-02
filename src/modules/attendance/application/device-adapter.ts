export interface ExternalAttendanceEvent {
  externalEventId: string;
  subjectToken: string;
  occurredAt: Date;
  eventKind: "CHECK_IN" | "CHECK_OUT" | "PRESENCE";
  metadata?: Record<string, unknown>;
}

export interface AttendanceDeviceAdapter {
  readonly type: "RFID" | "BARCODE" | "QR_CODE" | "BIOMETRIC" | "OTHER";
  verifyAndNormalize(payload: unknown): Promise<ExternalAttendanceEvent>;
}

export class UnsupportedFacialRecognitionError extends Error {
  constructor() {
    super("Facial-recognition processing is not supported");
    this.name = "UnsupportedFacialRecognitionError";
  }
}

// Future integrations may implement this port only after a separate privacy,
// legal, security, consent, and biometric-retention review is approved.
export interface FutureFacialRecognitionAdapter {
  verifyAndNormalize(_payload: never): Promise<never>;
}
