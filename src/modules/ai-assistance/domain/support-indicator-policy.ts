import type { SupportFactor } from "@/modules/ai-assistance/domain/ai-contracts";

export const attendanceReviewRule = {
  key: "attendance.human_review",
  version: "2026-09-01.1",
  minimumRecords: 5,
  thresholdBasisPoints: 7500,
} as const;

export type AttendanceObservation = {
  studentProfileId: string;
  campusId: string;
  totalRecords: number;
  presentFractionTotal: number;
};

export type IndicatorCandidate = AttendanceObservation & {
  attendanceBasisPoints: number;
  factors: SupportFactor[];
  reasonSummary: string;
};

export function identifyAttendanceReviewCandidates(
  observations: readonly AttendanceObservation[],
): IndicatorCandidate[] {
  return observations.flatMap((observation) => {
    if (observation.totalRecords < attendanceReviewRule.minimumRecords)
      return [];
    const attendanceBasisPoints = Math.round(
      observation.presentFractionTotal / observation.totalRecords,
    );
    if (attendanceBasisPoints >= attendanceReviewRule.thresholdBasisPoints)
      return [];
    return [
      {
        ...observation,
        attendanceBasisPoints,
        factors: [
          {
            key: "recorded_attendance_rate",
            label: "Recorded attendance",
            value: attendanceBasisPoints / 100,
            explanation: `${observation.totalRecords} attendance records were included; this may reflect data quality, approved leave, or circumstances requiring human context.`,
          },
        ],
        reasonSummary:
          "Recorded attendance is below the staff-configured review threshold. This is not a prediction or decision; an authorised staff member must verify context and data quality.",
      },
    ];
  });
}
