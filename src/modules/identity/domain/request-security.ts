import { createHash } from "node:crypto";

export interface RequestMetadata {
  correlationId: string;
  ipHash?: string;
  userAgentHash?: string;
}

function safeHash(value: string | null): string | undefined {
  return value
    ? createHash("sha256").update(value).digest("base64url")
    : undefined;
}

export function requestMetadata(headers: Headers): RequestMetadata {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const suppliedCorrelationId = headers.get("x-correlation-id");
  return {
    correlationId:
      suppliedCorrelationId &&
      /^[a-zA-Z0-9._:-]{1,64}$/.test(suppliedCorrelationId)
        ? suppliedCorrelationId
        : crypto.randomUUID(),
    ipHash: safeHash(forwarded ?? null),
    userAgentHash: safeHash(headers.get("user-agent")),
  };
}

export function hasTrustedMutationOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return process.env.NODE_ENV === "test";

  try {
    const configuredOrigin = process.env.APP_ORIGIN;
    if (
      configuredOrigin &&
      new URL(origin).origin === new URL(configuredOrigin).origin
    )
      return true;
    if (process.env.NODE_ENV === "production") return false;

    // Development previews such as GitHub Codespaces terminate HTTPS at a
    // trusted forwarding proxy. Their browser origin cannot equal the local
    // APP_ORIGIN, so verify the proxy-preserved request host instead.
    const forwardedHosts =
      headers
        .get("x-forwarded-host")
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean) ?? [];
    const requestHosts = new Set(
      [headers.get("host"), ...forwardedHosts].filter(
        (value): value is string => Boolean(value),
      ),
    );
    if (!requestHosts.has(new URL(origin).host)) return false;

    const forwardedProtocol = headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    return (
      !forwardedProtocol || new URL(origin).protocol === `${forwardedProtocol}:`
    );
  } catch {
    return false;
  }
}

export function hasSafeFetchMetadata(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}
