"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SchoolContextSelector({
  trustId,
  schoolId,
  campusId,
  academicYearId,
  academicYearName,
  schools,
}: {
  trustId: string;
  schoolId: string;
  campusId?: string;
  academicYearId: string;
  academicYearName: string;
  schools: readonly {
    id: string;
    name: string;
    campuses: readonly { id: string; name: string }[];
  }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function changeSchool(nextSchoolId: string) {
    const school = schools.find((item) => item.id === nextSchoolId);
    setPending(true);
    const response = await fetch("/api/auth/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trustId,
        schoolId: nextSchoolId,
        campusId: school?.campuses[0]?.id,
        academicYearId,
      }),
    });
    setPending(false);
    if (response.ok) router.refresh();
  }
  return (
    <div className="context-selector">
      <label htmlFor="school-context">School context</label>
      <select
        id="school-context"
        value={schoolId}
        disabled={pending}
        onChange={(event) => void changeSchool(event.target.value)}
      >
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
      <small>
        {academicYearName}
        {campusId ? " · Campus scoped" : ""}
      </small>
    </div>
  );
}
