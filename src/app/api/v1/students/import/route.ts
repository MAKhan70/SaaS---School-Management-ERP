import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import {
  hasTrustedMutationOrigin,
  requestMetadata,
} from "@/modules/identity/domain/request-security";
import { StudentService } from "@/modules/students/application/student-service";
import { AuthorizationError } from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";
import { readLimitedBody, RequestBodyError } from "@/server/http/request-body";
import { z } from "zod";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request.headers))
    return NextResponse.json({ error: "Untrusted request" }, { status: 403 });
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)nasaq_session=([^;]+)/)?.[1];
  const context = await new AuthenticationService(prisma).authenticateSession(
    token,
  );
  if (!context)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = z
        .object({ rows: z.array(z.unknown()).max(10_000) })
        .parse(
          JSON.parse(await readLimitedBody(request, 5_000_000)) as unknown,
        );
      return NextResponse.json(
        await new StudentService(prisma).commitImport(
          context,
          body.rows,
          requestMetadata(request.headers),
        ),
        { status: 201 },
      );
    }
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("text/csv"))
      return NextResponse.json(
        { error: "Only CSV imports are supported" },
        { status: 415 },
      );
    const csv = await readLimitedBody(request, 2_000_000);
    return NextResponse.json(
      await new StudentService(prisma).previewImport(context, csv),
    );
  } catch (error) {
    if (error instanceof RequestBodyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json(
      { error: "Import preview could not be generated" },
      { status: 400 },
    );
  }
}
