import { AuditorDto } from "./auth";
import type { SchemaValue } from "./form-builder";

export interface FormTemplateRequest {
  title: string;
  description?: string;
  schema: string;
}

export interface FormTemplateResponse {
  id: string;
  title: string;
  description?: string;
  schema: SchemaValue;
  createdAt: string;
  modifiedAt: string;
  createdBy: AuditorDto;
  modifiedBy: AuditorDto;
}
