import { AuditorDto } from "./auth";
import { FormSchema, SchemaValue } from "./form-builder";
import { QuarterResponse } from "./quarter";

export type RecruitmentType = "NEW_MEMBER" | "INTERNAL_OPERATION";

export interface RecruitmentRequest {
  title: string;
  description: string;
  completionMessage?: string;
  startAt: string;
  endAt: string;
  quarterId: string;
  /** The application form's questions; the recruitment owns them. */
  questions: FormSchema;
  active: boolean;
  type: RecruitmentType;
}

export interface RecruitmentResponse {
  id: string;
  title: string;
  description: string;
  completionMessage: string | null;
  startAt: string;
  endAt: string;
  quarter: QuarterResponse;
  active: boolean;
  type: RecruitmentType;
  questions: SchemaValue;
  createdAt: string;
  modifiedAt: string;
  createdBy: AuditorDto;
  modifiedBy: AuditorDto;
}

export interface RecruitmentCompletionMessageResponse {
  completionMessage: string | null;
}
