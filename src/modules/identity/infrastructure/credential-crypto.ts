import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
const KEY_LENGTH = 64;
const SCRYPT_COST = 16_384;

function deriveKey(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, length, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
  });
  return [
    "scrypt",
    SCRYPT_COST,
    8,
    1,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelism, saltValue, hashValue] =
    encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !cost ||
    !blockSize ||
    !parallelism ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }

  const expected = Buffer.from(hashValue, "base64url");
  const actual = await deriveKey(
    password,
    Buffer.from(saltValue, "base64url"),
    expected.length,
    { N: Number(cost), r: Number(blockSize), p: Number(parallelism) },
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueValue(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!secret || secret.length < 32)
  ) {
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  }
  return createHash("sha256")
    .update(`${secret ?? "local-development-only-auth-secret"}:${value}`)
    .digest("base64url");
}
