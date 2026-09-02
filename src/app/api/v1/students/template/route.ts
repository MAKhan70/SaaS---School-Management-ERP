import { NextResponse } from "next/server";

import { studentCsvHeaders } from "@/modules/students/domain/student-contracts";

export function GET() {
  const example = [
    "Aarav",
    "Joshi",
    "2013-08-12",
    "2026-04-01",
    "academic_year_id",
    "campus_id",
    "section_id",
    "+919000000001",
    "guardian@example.test",
  ];
  return new NextResponse(
    `${studentCsvHeaders.join(",")}\n${example.join(",")}\n`,
    {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition":
          'attachment; filename="student-import-template.csv"',
        "cache-control": "no-store",
      },
    },
  );
}
