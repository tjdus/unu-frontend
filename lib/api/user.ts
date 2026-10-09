import { UserResponseDto, UserSummaryDto } from "../interfaces/auth";
import { UserRoleUpdateRequestDto } from "../interfaces/role";
import axiosInstance from "./axiosInstance";
import { MemberActivitySummary } from "../interfaces/member-activity";

export async function getMemberActivitySummaries(): Promise<MemberActivitySummary[]> {
  const response = await axiosInstance.get<MemberActivitySummary[]>("/users/activity-summary");
  return response.data;
}

// ===== Authenticated APIs =====

export async function getAllUsers(): Promise<UserResponseDto[]> {
  const response = await axiosInstance.get<UserResponseDto[]>("/users");
  return response.data;
}

export async function getUserById(userId: string): Promise<UserResponseDto> {
  const response = await axiosInstance.get<UserResponseDto>(`/users/${userId}`);
  return response.data;
}

export async function getUserByStudentId(
  studentId: string,
): Promise<UserResponseDto> {
  const response = await axiosInstance.get<UserResponseDto>(
    `/users/studentId/${studentId}`,
  );
  return response.data;
}

export async function updateUserActiveStatus(
  userId: string,
  active: boolean,
): Promise<UserResponseDto> {
  const response = await axiosInstance.patch<UserResponseDto>(
    `/manager/users/${userId}/active?active=${active}`,
  );
  return response.data;
}

export async function changeUserRole(
  data: UserRoleUpdateRequestDto,
): Promise<UserResponseDto> {
  const response = await axiosInstance.put<UserResponseDto>(
    "/admin/users/role",
    data,
  );
  return response.data;
}

export async function resetUserPassword(
  userId: string,
): Promise<{ temporaryPassword: string }> {
  const response = await axiosInstance.post<{ temporaryPassword: string }>(
    `/admin/users/${userId}/reset-password`,
  );
  return response.data;
}

export async function removeUsers(userIds: string[]): Promise<void> {
  await axiosInstance.post("/admin/users/remove", { userIds });
}

export async function calculateActiveMembers(): Promise<void> {
  await axiosInstance.post("/admin/users/calculate-active");
}

export async function searchUsers(params: {
  role?: string;
  isCurrentQuarterActive?: boolean;
  joinedQuarter?: string;
  name?: string;
  studentId?: string;
}): Promise<UserResponseDto[]> {
  const queryParams = new URLSearchParams();
  if (params.role) queryParams.append("role", params.role);
  if (params.isCurrentQuarterActive !== undefined)
    queryParams.append("is-active", params.isCurrentQuarterActive.toString());
  if (params.joinedQuarter)
    queryParams.append("joined-quarter", params.joinedQuarter);
  if (params.name) queryParams.append("name", params.name);
  if (params.studentId) queryParams.append("student-id", params.studentId);

  const response = await axiosInstance.get<UserResponseDto[]>(
    `/users/search?${queryParams.toString()}`,
  );
  return response.data;
}

export async function searchUserSummaries(params: {
  name?: string;
  studentId?: string;
}): Promise<UserSummaryDto[]> {
  const queryParams = new URLSearchParams();
  if (params.name) queryParams.append("name", params.name);
  if (params.studentId) queryParams.append("student-id", params.studentId);

  const response = await axiosInstance.get<UserSummaryDto[]>(
    `/users/search/summary?${queryParams.toString()}`,
  );
  return response.data;
}
