import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyFromEnvironment(): Buffer {
  const encoded = process.env.STUDENT_DATA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Student data encryption is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32)
    throw new Error("Student data encryption key must be 32 bytes");
  return key;
}

export interface EncryptedStudentData {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  authTag: Uint8Array<ArrayBuffer>;
  keyVersion: number;
}

export function encryptStudentData(
  value: unknown,
  scope: { trustId: string; studentId: string; type: string },
  key = keyFromEnvironment(),
): EncryptedStudentData {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(
    Buffer.from(`${scope.trustId}:${scope.studentId}:${scope.type}`),
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: Uint8Array.from(ciphertext),
    iv: Uint8Array.from(iv),
    authTag: Uint8Array.from(cipher.getAuthTag()),
    keyVersion: 1,
  };
}

export function decryptStudentData(
  value: {
    ciphertext: Uint8Array;
    iv: Uint8Array;
    authTag: Uint8Array;
    keyVersion: number;
  },
  scope: { trustId: string; studentId: string; type: string },
  key = keyFromEnvironment(),
): unknown {
  const decipher = createDecipheriv("aes-256-gcm", key, value.iv);
  decipher.setAAD(
    Buffer.from(`${scope.trustId}:${scope.studentId}:${scope.type}`),
  );
  decipher.setAuthTag(value.authTag);
  return JSON.parse(
    Buffer.concat([
      decipher.update(value.ciphertext),
      decipher.final(),
    ]).toString("utf8"),
  ) as unknown;
}

export function maskIdentifier(lastFour: string): string {
  return `•••• ${lastFour.slice(-4)}`;
}
