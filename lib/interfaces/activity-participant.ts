import { ActivityResponse } from "./activity";
import { UserResponseDto } from "./auth";

export type LectureParticipationMode = "INDIVIDUAL" | "GROUP";

export interface ActivityParticipantResponse {
  id: string; // UUID
  userId: string; // UUID
  status: "APPLIED" | "APPROVED" | "REJECTED";
  completed: boolean;
  appliedPosition?: string | null;
  applicationMessage?: string | null;
  lectureParticipationMode?: LectureParticipationMode | null;
  reviewMessage?: string | null;
  createdAt: string;
  modifiedAt: string;
  activity: ActivityResponse;
  user: UserResponseDto;
}

export interface ActivityParticipantRequest {
  activityId: string;
  userId?: string;
  status?: "APPLIED" | "APPROVED" | "REJECTED";
  reviewMessage?: string;
}

export interface ActivityJoinRequest {
  refundBankName?: string;
  refundAccountNumber?: string;
  refundAccountHolder?: string;
  agreedToDepositPolicy?: boolean;
  confirmedDepositPayment?: boolean;
  agreedToPrivacy?: boolean;
  agreedToPromotion?: boolean;
  appliedPosition?: string;
  applicationMessage?: string;
}

export interface ActivityParticipantRefundAccount {
  participantId: string;
  userId: string;
  userName: string;
  studentId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  paymentConfirmedAt: string;
  promotionAgreedAt: string | null;
}

export interface ActivityParticipantSummary {
  id: string;
  name: string;
}

export interface ActivityCapacityResponse {
  participantLimit: number | null;
  participantCount: number | null;
  full: boolean;
}

export const ACTIVITY_PARTICIPANT_STATUS_MAP: Record<string, string> = {
  APPLIED: "신청 완료",
  APPROVED: "참여 확정",
  REJECTED: "신청 반려",
};
