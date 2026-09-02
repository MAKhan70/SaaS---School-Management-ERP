import { NextResponse } from "next/server";

import { AuthenticationService } from "@/modules/identity/application/auth-service";
import { requestMetadata } from "@/modules/identity/domain/request-security";
import { StudentService } from "@/modules/students/application/student-service";
import { AuthorizationError } from "@/server/authorization/authorize";
import { prisma } from "@/server/database/prisma";

export async function GET(request: Request) {
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
    const csv = await new StudentService(prisma).exportCsv(
      context,
      requestMetadata(request.headers),
    );
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="students.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json(
      { error: "Export could not be completed" },
      { status: 500 },
    );
  }
}
