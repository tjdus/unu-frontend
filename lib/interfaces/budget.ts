export type BudgetCategory =
  // 수입
  | "INCOME_CARRYOVER"
  | "INCOME_MEMBERSHIP"
  | "INCOME_STUDY_DEPOSIT"
  | "INCOME_OTHER"
  // 지출 - 지원비
  | "EXPENSE_BOOK_SUPPORT"
  | "EXPENSE_SERVER_SUPPORT"
  | "EXPENSE_INTEGRATED_SUPPORT"
  | "EXPENSE_DEV_SUPPORT"
  | "EXPENSE_SUPPORT_OTHER"
  // 지출 - 프로젝트
  | "EXPENSE_PROJECT_SUPPORT"
  | "EXPENSE_MENTOR_FEE"
  // 지출 - 정기결제
  | "EXPENSE_GPTEE"
  | "EXPENSE_TOKSRAP"
  | "EXPENSE_DISCORD"
  | "EXPENSE_GOOGLE_WORKSPACE"
  | "EXPENSE_SUBSCRIPTION_OTHER"
  // 지출 - 스터디
  | "EXPENSE_LECTURE_FEE"
  | "EXPENSE_STUDY_DEPOSIT_REFUND"
  | "EXPENSE_ONLINE_COURSE"
  | "EXPENSE_MENTOR_REWARD"
  | "EXPENSE_STUDY_OTHER"
  // 지출 - 기타
  | "EXPENSE_MT"
  | "EXPENSE_GENERAL_MEETING"
  | "EXPENSE_OFFICE_SNACK"
  | "EXPENSE_TAX_REFUND"
  | "EXPENSE_OTHER";

export const CATEGORY_LABEL: Record<BudgetCategory, string> = {
  INCOME_CARRYOVER: "전월 이월금",
  INCOME_MEMBERSHIP: "월별 학회비",
  INCOME_STUDY_DEPOSIT: "스터디 보증금",
  INCOME_OTHER: "기타 수입",
  EXPENSE_BOOK_SUPPORT: "도서지원비",
  EXPENSE_SERVER_SUPPORT: "서버지원비",
  EXPENSE_INTEGRATED_SUPPORT: "통합 지원비",
  EXPENSE_DEV_SUPPORT: "개발 지원비",
  EXPENSE_SUPPORT_OTHER: "학회원 지원비 기타",
  EXPENSE_PROJECT_SUPPORT: "프로젝트 지원비",
  EXPENSE_MENTOR_FEE: "멘토 보수",
  EXPENSE_GPTEE: "지피티",
  EXPENSE_TOKSRAP: "톡서랍",
  EXPENSE_DISCORD: "디스코드",
  EXPENSE_GOOGLE_WORKSPACE: "구글 워크스페이스",
  EXPENSE_SUBSCRIPTION_OTHER: "정기결제 기타",
  EXPENSE_LECTURE_FEE: "강의형 스터디 강의비",
  EXPENSE_STUDY_DEPOSIT_REFUND: "스터디 보증금 환급",
  EXPENSE_ONLINE_COURSE: "인강 구매비",
  EXPENSE_MENTOR_REWARD: "멘토 보수",
  EXPENSE_STUDY_OTHER: "스터디 기타",
  EXPENSE_MT: "엠티",
  EXPENSE_GENERAL_MEETING: "개총/종총",
  EXPENSE_OFFICE_SNACK: "관리자실 간식비",
  EXPENSE_TAX_REFUND: "15% 환급비",
  EXPENSE_OTHER: "기타",
};

// 카테고리 그룹 정의
export const CATEGORY_GROUPS = [
  {
    label: "수입",
    isIncome: true,
    categories: [
      "INCOME_CARRYOVER",
      "INCOME_MEMBERSHIP",
      "INCOME_STUDY_DEPOSIT",
      "INCOME_OTHER",
    ] as BudgetCategory[],
  },
  {
    label: "지원비",
    isIncome: false,
    categories: [
      "EXPENSE_BOOK_SUPPORT",
      "EXPENSE_SERVER_SUPPORT",
      "EXPENSE_INTEGRATED_SUPPORT",
      "EXPENSE_DEV_SUPPORT",
      "EXPENSE_SUPPORT_OTHER",
    ] as BudgetCategory[],
  },
  {
    label: "프로젝트",
    isIncome: false,
    categories: [
      "EXPENSE_PROJECT_SUPPORT",
      "EXPENSE_MENTOR_FEE",
    ] as BudgetCategory[],
  },
  {
    label: "정기결제",
    isIncome: false,
    categories: [
      "EXPENSE_GPTEE",
      "EXPENSE_TOKSRAP",
      "EXPENSE_DISCORD",
      "EXPENSE_GOOGLE_WORKSPACE",
      "EXPENSE_SUBSCRIPTION_OTHER",
    ] as BudgetCategory[],
  },
  {
    label: "스터디",
    isIncome: false,
    categories: [
      "EXPENSE_LECTURE_FEE",
      "EXPENSE_STUDY_DEPOSIT_REFUND",
      "EXPENSE_ONLINE_COURSE",
      "EXPENSE_MENTOR_REWARD",
      "EXPENSE_STUDY_OTHER",
    ] as BudgetCategory[],
  },
  {
    label: "기타",
    isIncome: false,
    categories: [
      "EXPENSE_MT",
      "EXPENSE_GENERAL_MEETING",
      "EXPENSE_OFFICE_SNACK",
      "EXPENSE_TAX_REFUND",
      "EXPENSE_OTHER",
    ] as BudgetCategory[],
  },
];

export interface BudgetItemResponse {
  id: string;
  category: BudgetCategory;
  plannedAmount: number;
  actualAmount: number | null;
  note: string | null;
  displayOrder: number | null;
}

export interface BudgetPlanResponse {
  id: string;
  quarterId: string;
  quarterName: string;
  month: number;
  note: string | null;
  items: BudgetItemResponse[];
  totalIncome: number;
  totalExpense: number;
  plannedMargin: number;
  actualMargin: number;
}

export interface BudgetItemRequest {
  category: BudgetCategory;
  plannedAmount: number;
  actualAmount?: number | null;
  note?: string | null;
  displayOrder?: number;
}

export interface BudgetPlanRequest {
  quarterId: string;
  month: number;
  note?: string;
  items: BudgetItemRequest[];
}

export type BudgetImportStatus = "CREATE" | "UPDATE" | "SKIP" | "ERROR";

export interface BudgetImportChange {
  categoryLabel: string;
  field: "예상" | "실제";
  before: number;
  after: number;
}

export interface BudgetImportMonth {
  month: number;
  status: BudgetImportStatus;
  quarterName: string | null;
  changes: BudgetImportChange[];
}

export interface BudgetImportResult {
  year: number;
  months: BudgetImportMonth[];
  warnings: string[];
  errors: string[];
}

export interface StudyDepositLedgerEntryResponse {
  id: string;
  activityId: string;
  activityTitle: string;
  participantId: string;
  userName: string;
  studentId: string | null;
  amount: number;
  occurredAt: string;
}
