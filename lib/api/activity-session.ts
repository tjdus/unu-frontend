import axiosInstance from "./axiosInstance";
import {
  ActivitySessionBulkRequestDto,
  ActivitySessionRequestDto,
  ActivitySessionResponseDto,
  ChronologicalActivitySession,
} from "../interfaces/activity-session";
import { orderActivitySessions } from "@/lib/utils/activity-sessions";

/**
 * Get all activity sessions
 */
export const getAllActivitySessions = async (): Promise<
  ChronologicalActivitySession[]
> => {
  const response =
    await axiosInstance.get<ActivitySessionResponseDto[]>("/activity-sessions");
  return orderActivitySessions(response.data);
};

export const createActivitySessionsBulk = async (
  data: ActivitySessionBulkRequestDto,
): Promise<ActivitySessionResponseDto[]> => {
  const response = await axiosInstance.post<ActivitySessionResponseDto[]>(
    "/activity-sessions/bulk",
    data,
  );
  return response.data;
};

/**
 * Create a new activity session
 */
export const createActivitySession = async (
  data: ActivitySessionRequestDto,
): Promise<ActivitySessionResponseDto> => {
  const response = await axiosInstance.post<ActivitySessionResponseDto>(
    "/activity-sessions",
    data,
  );
  return response.data;
};

/**
 * Get activity session by ID
 */
export const getActivitySessionById = async (
  id: string,
): Promise<ActivitySessionResponseDto> => {
  const response = await axiosInstance.get<ActivitySessionResponseDto>(
    `/activity-sessions/${id}`,
  );
  return response.data;
};

/**
 * Update activity session by ID
 */
export const updateActivitySession = async (
  id: string,
  data: ActivitySessionRequestDto,
): Promise<ActivitySessionResponseDto> => {
  const response = await axiosInstance.put<ActivitySessionResponseDto>(
    `/activity-sessions/${id}`,
    data,
  );
  return response.data;
};

/**
 * Delete activity session by ID
 */
export const deleteActivitySession = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/activity-sessions/${id}`);
};

/**
 * Get all activity sessions by activity ID
 */
export const getActivitySessionsByActivityId = async (
  activityId: string,
): Promise<ChronologicalActivitySession[]> => {
  const response = await axiosInstance.get<ActivitySessionResponseDto[]>(
    `/activity-sessions/activities/${activityId}`,
  );
  return orderActivitySessions(response.data);
};
