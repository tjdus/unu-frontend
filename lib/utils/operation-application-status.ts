type BadgeVariant = "secondary" | "destructive" | "outline";

const STATUS_TEXT: Record<string, string> = {
  APPLIED: "제출됨",
  IN_PROGRESS: "검토 중",
  WAITING: "대기",
  HOLD: "보류",
  PASSED: "승인",
  REJECTED: "미승인",
};

export interface MyApplicationBadgeInfo {
  label: string; // 예: "내 신청 · 제출됨"
  variant: BadgeVariant;
  className?: string;
}


export function getMyApplicationBadge(status: string): MyApplicationBadgeInfo {
  const label = `내 신청 · ${STATUS_TEXT[status] ?? status}`;
  return {
    label,
    variant: "outline",
    className: "border-border bg-background text-muted-foreground",
  };
}
