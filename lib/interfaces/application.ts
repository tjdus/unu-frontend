import { RecruitmentType } from "./recruitment";

export type ApplicationAnswers = Record<string, string | string[]>;

export interface OperationApplicationRequest {
  answers: ApplicationAnswers;
}

export interface ApplicationRequest {
  recruitmentId: string;
  name: string;
  studentId: string;
  major: string;
  subMajor?: string;
  email: string;
  githubId?: string;
  phoneNumber: string;
  password?: string;
  answers: ApplicationAnswers;
  /** 신규 제출 시 개인정보 수집·이용 동의 (필수) */
  agreedToPrivacy?: boolean;
}

export interface ApplicationResponse {
  id: string;
  recruitmentId: string;
  recruitmentTitle: string;
  recruitmentType: RecruitmentType;
  formSnapshot: string | Record<string, unknown>;
  name: string;
  studentId: string;
  major: string;
  subMajor: string | null;
  email: string;
  githubId: string | null;
  phoneNumber: string;
  answers: string | ApplicationAnswers;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface PasswordRequest {
  password: string;
}

export interface ApplicationReviewRequest {
  status: string;
}

export interface ApplicationSearchQuery {
  name: string;
  email: string;
}

export interface ApplicationLookupResponse {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface ApplicationVerificationResponse {
  application: ApplicationResponse;
  accessToken: string;
}

export interface ApplicationLectureRoomScheduleImportResponse {
  quarterId: string;
  userId: string;
  userName: string;
  createdCount: number;
  existingCount: number;
}
