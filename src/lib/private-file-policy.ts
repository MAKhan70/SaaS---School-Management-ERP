import { z } from "zod";

export const privateStorageKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(500)
  .regex(/^private\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/)
  .refine(
    (value) => !value.includes(".."),
    "Storage key must not contain traversal segments",
  );

export const privateDocumentMimeTypeSchema = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const privateDocumentNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[^\u0000-\u001f\u007f]+$/, "File name contains control characters");
