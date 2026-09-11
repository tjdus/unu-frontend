import axiosInstance from "./axiosInstance";
import {
  BudgetPlanRequest,
  BudgetPlanResponse,
  StudyDepositLedgerEntryResponse,
} from "../interfaces/budget";

// 분기별 예산 계획 목록 조회
export async function getBudgetPlansByQuarter(
  quarterId: string,
): Promise<BudgetPlanResponse[]> {
  const res = await axiosInstance.get<BudgetPlanResponse[]>("/budget", {
    params: { quarterId },
  });
  return res.data;
}

// 특정 월 예산 계획 조회
export async function getBudgetPlanByMonth(
  quarterId: string,
  month: number,
): Promise<BudgetPlanResponse> {
  const res = await axiosInstance.get<BudgetPlanResponse>("/budget/month", {
    params: { quarterId, month },
  });
  return res.data;
}

// 예산 계획 단건 조회
export async function getBudgetPlanById(
  id: string,
): Promise<BudgetPlanResponse> {
  const res = await axiosInstance.get<BudgetPlanResponse>(`/budget/${id}`);
  return res.data;
}

// 예산 계획 생성
export async function createBudgetPlan(
  data: BudgetPlanRequest,
): Promise<BudgetPlanResponse> {
  const res = await axiosInstance.post<BudgetPlanResponse>("/budget", data);
  return res.data;
}

// 예산 계획 수정
export async function updateBudgetPlan(
  id: string,
  data: BudgetPlanRequest,
): Promise<BudgetPlanResponse> {
  const res = await axiosInstance.put<BudgetPlanResponse>(
    `/budget/${id}`,
    data,
  );
  return res.data;
}

// 예산 계획 삭제
export async function deleteBudgetPlan(id: string): Promise<void> {
  await axiosInstance.delete(`/budget/${id}`);
}

// 전월 이월금 조회
export async function getCarryover(
  quarterId: string,
  month: number,
): Promise<number> {
  const res = await axiosInstance.get<number>("/budget/carryover", {
    params: { quarterId, month },
  });
  return res.data;
}

// 가계부 엑셀(.xlsx) 다운로드 (해당 연도 1~12월 전체)
export async function downloadBudgetExcel(year: number): Promise<Blob> {
  const res = await axiosInstance.get("/budget/export", {
    params: { year },
    responseType: "blob",
  });
  return res.data;
}

// 스터디 보증금 카테고리(수입/환급)의 참여자별 상세 내역 조회
export async function getStudyDepositLedgerEntries(
  quarterId: string,
  month: number,
  category: "INCOME_STUDY_DEPOSIT" | "EXPENSE_STUDY_DEPOSIT_REFUND",
): Promise<StudyDepositLedgerEntryResponse[]> {
  const res = await axiosInstance.get<StudyDepositLedgerEntryResponse[]>(
    "/budget/deposit-entries",
    { params: { quarterId, month, category } },
  );
  return res.data;
}
