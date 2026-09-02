import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  parseRequestBody,
  readLimitedBody,
  type RequestBodyError,
} from "@/server/http/request-body";

describe("bounded request bodies", () => {
  it("parses JSON and URL-encoded inputs through Zod", async () => {
    const schema = z.object({ name: z.string().min(1) });
    await expect(
      parseRequestBody(
        new Request("https://example.test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Synthetic" }),
        }),
        schema,
      ),
    ).resolves.toEqual({ name: "Synthetic" });
    await expect(
      parseRequestBody(
        new Request("https://example.test", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "name=Synthetic",
        }),
        schema,
      ),
    ).resolves.toEqual({ name: "Synthetic" });
  });

  it("rejects declared and streamed bodies above the limit", async () => {
    const declared = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "100" },
      body: "small",
    });
    await expect(readLimitedBody(declared, 10)).rejects.toMatchObject({
      status: 413,
    } satisfies Partial<RequestBodyError>);

    const streamed = new Request("https://example.test", {
      method: "POST",
      body: "01234567890",
    });
    await expect(readLimitedBody(streamed, 10)).rejects.toMatchObject({
      status: 413,
    } satisfies Partial<RequestBodyError>);
  });

  it("rejects unsupported media types", async () => {
    await expect(
      parseRequestBody(
        new Request("https://example.test", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "name=Synthetic",
        }),
        z.object({ name: z.string() }),
      ),
    ).rejects.toMatchObject({ status: 415 });
  });
});
