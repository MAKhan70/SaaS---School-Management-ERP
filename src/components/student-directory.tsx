"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DirectoryData = {
  students: Array<{
    id: string;
    studentNumber: string;
    lifecycleStatus: string;
    person: {
      firstName: string;
      lastName: string;
      preferredName?: string | null;
    };
    admissions: Array<{ admissionNumber: string }>;
    enrollments: Array<{
      rollNumber?: string | null;
      campus: { name: string };
      section: { name: string; gradeClass: { name: string } };
    }>;
    houseAssignments: Array<{ house: { name: string } }>;
  }>;
  filters: {
    grades: Array<{ id: string; name: string }>;
    sections: Array<{ id: string; name: string }>;
    houses: Array<{ id: string; name: string }>;
  };
  pagination: { total: number };
};

export function StudentDirectory() {
  const [data, setData] = useState<DirectoryData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    gradeId: "",
    sectionId: "",
    houseId: "",
  });
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value),
    );
    try {
      const response = await fetch(`/api/v1/students?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setData((await response.json()) as DirectoryData);
    } catch {
      setError("The student directory could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="student-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Student information system</p>
          <h1>Students</h1>
          <p>
            Search the current school without exposing restricted health or
            identity information.
          </p>
        </div>
        <div className="student-actions">
          <Link className="button secondary" href={"/students/import" as Route}>
            Import
          </Link>
          <Link
            className="button secondary"
            href={"/api/v1/students/export" as Route}
            prefetch={false}
          >
            Export permitted data
          </Link>
          <Link className="button primary" href={"/students/new" as Route}>
            Add student
          </Link>
        </div>
      </header>
      <form
        className="student-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="wide-field">
          Search
          <input
            aria-label="Search students"
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            placeholder="Name, student or admission number"
          />
        </label>
        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="">All statuses</option>
            {[
              "ADMITTED",
              "ACTIVE",
              "WITHDRAWN",
              "TRANSFERRED",
              "GRADUATED",
              "ALUMNI",
              "ARCHIVED",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Grade
          <select
            value={filters.gradeId}
            onChange={(event) =>
              setFilters({ ...filters, gradeId: event.target.value })
            }
          >
            <option value="">All grades</option>
            {data?.filters.grades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select
            value={filters.sectionId}
            onChange={(event) =>
              setFilters({ ...filters, sectionId: event.target.value })
            }
          >
            <option value="">All sections</option>
            {data?.filters.sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          House
          <select
            value={filters.houseId}
            onChange={(event) =>
              setFilters({ ...filters, houseId: event.target.value })
            }
          >
            <option value="">All houses</option>
            {data?.filters.houses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" type="submit" disabled={loading}>
          Apply
        </button>
      </form>
      {loading ? (
        <div className="student-state" role="status">
          Loading students…
        </div>
      ) : error ? (
        <div className="student-state error" role="alert">
          {error}
          <button className="button secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : !data?.students.length ? (
        <div className="student-state">
          <h2>No students found</h2>
          <p>Change the filters or create the first student for this school.</p>
        </div>
      ) : (
        <div className="student-table-wrap">
          <table className="student-table">
            <caption>
              {data.pagination.total} students in the selected scope
            </caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Admission</th>
                <th scope="col">Class and section</th>
                <th scope="col">Campus</th>
                <th scope="col">House</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => {
                const enrollment = student.enrollments[0];
                return (
                  <tr key={student.id}>
                    <td>
                      <Link href={`/students/${student.id}` as Route}>
                        <strong>
                          {student.person.preferredName ||
                            `${student.person.firstName} ${student.person.lastName}`}
                        </strong>
                      </Link>
                      <small>{student.studentNumber}</small>
                    </td>
                    <td>{student.admissions[0]?.admissionNumber ?? "—"}</td>
                    <td>
                      {enrollment
                        ? `${enrollment.section.gradeClass.name} · ${enrollment.section.name}`
                        : "Not enrolled"}
                    </td>
                    <td>{enrollment?.campus.name ?? "—"}</td>
                    <td>{student.houseAssignments[0]?.house.name ?? "—"}</td>
                    <td>
                      <span className="status-chip">
                        {student.lifecycleStatus
                          .toLowerCase()
                          .replaceAll("_", " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
