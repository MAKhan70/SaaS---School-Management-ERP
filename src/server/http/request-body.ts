import { z } from "zod";

export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

const DEFAULT_MAX_BYTES = 1_000_000;

export async function readLimitedBody(
  request: Request,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError("Request body is too large", 413);
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let value = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError("Request body is too large", 413);
      }
      value += decoder.decode(chunk.value, { stream: true });
    }
    return value + decoder.decode();
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Request body is not valid UTF-8", 400);
  } finally {
    reader.releaseLock();
  }
}

export async function parseRequestBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  options: { maxBytes?: number } = {},
): Promise<z.output<TSchema>> {
  const contentType = (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  const body = await readLimitedBody(request, options.maxBytes);
  let value: unknown;
  if (contentType === "application/json") {
    try {
      value = JSON.parse(body) as unknown;
    } catch {
      throw new RequestBodyError("Request body is not valid JSON", 400);
    }
  } else if (contentType === "application/x-www-form-urlencoded") {
    value = Object.fromEntries(new URLSearchParams(body));
  } else {
    throw new RequestBodyError("Unsupported content type", 415);
  }
  return schema.parse(value);
}

export function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}
