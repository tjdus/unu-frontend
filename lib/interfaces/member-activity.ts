export type MemberActivityPolicyStatus =
  | "FULFILLED"
  | "WITHIN_PERIOD"
  | "REMOVAL_TARGET"
  | "CHECK_REQUIRED";

export interface MemberCompletedActivity {
  activityId: string;
  title: string;
  quarterName: string | null;
  joinedQuarter: boolean;
  evaluationPeriod: boolean;
}

export interface MemberActivitySummary {
  userId: string;
  name: string;
  studentId: string;
  joinedQuarterId: string | null;
  joinedQuarterName: string | null;
  evaluationEndQuarterName: string | null;
  joinedQuarterEndDate: string | null;
  evaluationEndDate: string | null;
  totalCompletedCount: number;
  joinedQuarterCompletedCount: number;
  evaluationCompletedQuarterCount: number;
  policyStatus: MemberActivityPolicyStatus;
  policyReason: string;
  completedActivities: MemberCompletedActivity[];
}
