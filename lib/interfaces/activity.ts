import { QuarterResponse } from "./quarter";
import { AuditorDto } from "./auth";

export const ACTIVITY_STATUS_MAP: Record<string, string> = {
  CREATED: "생성됨",
  OPEN: "모집중",
  ONGOING: "진행중",
  COMPLETED: "완료됨",
};

export interface ActivityTypeResponse {
  id: string;
  name: string;
  code: string;
}

export interface ActivityAssigneeResponse {
  id: string;
  name: string;
}

export interface ActivityResponse {
  id: string;
  title: string;
  description: string;
  status: string;
  activityType: ActivityTypeResponse;
  assignee: ActivityAssigneeResponse;
  quarter: QuarterResponse;
  startDate: string;
  endDate: string;
  recruitmentStartDate?: string | null;
  recruitmentEndDate?: string | null;
  parentActivityId?: string;
  listed?: boolean;
  depositAmount: number;
  participantLimit: number | null;
  recruitmentPositions?: string | null;
  discordUrl?: string | null;
  operationPlan?: string | null;
  instructorCareer?: string | null;
  createdAt: string;
  modifiedAt: string;
  createdBy: AuditorDto;
  modifiedBy: AuditorDto;
}

export interface ActivityRequest {
  title: string;
  description: string;
  status?: string;
  activityTypeId: string;
  assigneeId?: string;
  quarterId?: string;
  startDate: string;
  endDate: string;
  parentActivityId?: string;
  depositAmount?: number;
  participantLimit?: number;
  listed?: boolean;
  recruitmentPositions?: string | null;
  discordUrl?: string | null;
  recruitmentStartDate?: string | null;
  recruitmentEndDate?: string | null;
  operationPlan?: string | null;
  instructorCareer?: string | null;
  materialUrl?: string | null;
}

export interface ActivityTypeReponse {
  id: string;
  name: string;
}

export interface ActivityTypeRequest {
  name: string;
  code: string;
}
