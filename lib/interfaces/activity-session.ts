import { ActivityResponse } from "./activity";

export interface ActivitySessionRequestDto {
  activityId: string;
  date: string; // ISO date string format (YYYY-MM-DD)
  description: string;
}

export type ActivitySessionWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface ActivitySessionBulkRequestDto {
  activityId: string;
  startDate: string;
  endDate: string;
  weekdays: ActivitySessionWeekday[];
  intervalWeeks: number;
  excludedDates: string[];
  description: string;
}

export interface ActivitySessionResponseDto {
  id: string;
  activity: ActivityResponse;
  sessionNumber: number;
  date: string; // ISO date string format (YYYY-MM-DD)
  description: string;
}

export type ChronologicalActivitySession = ActivitySessionResponseDto & {
  displayNumber: number;
};
