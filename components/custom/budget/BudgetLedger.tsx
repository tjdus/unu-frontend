"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Upload,
  ListPlus,
} from "lucide-react";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import {
  BudgetPlanResponse,
  BudgetItemRequest,
  BudgetCategory,
  CATEGORY_LABEL,
  CATEGORY_GROUPS,
  DETAIL_MANAGED_CATEGORIES,
} from "@/lib/interfaces/budget";
import {
  getBudgetPlansByQuarter,
  createBudgetPlan,
  updateBudgetPlan,
  deleteBudgetPlan,
  getCarryover,
  downloadBudgetExcel,
} from "@/lib/api/budget";
import { StudyDepositDetailDialog } from "./StudyDepositDetailDialog";
import { BudgetImportDialog } from "./BudgetImportDialog";
import { ExpenseEntryDialog } from "./ExpenseEntryDialog";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// 참여자별 보증금 원장에서 자동 연동되는 카테고리 — 상세는 읽기 전용
const DEPOSIT_CATEGORIES = new Set<BudgetCategory>([
  "INCOME_STUDY_DEPOSIT",
  "EXPENSE_STUDY_DEPOSIT_REFUND",
]);

// 건별 상세 내역으로 직접 관리하는 카테고리 — 상세 창에서 등록·수정
const DETAIL_MANAGED = new Set<BudgetCategory>(DETAIL_MANAGED_CATEGORIES);

/**
 * 금액을 사람이 직접 못 고치는 카테고리.
 * 보증금은 항상, 건별 상세 내역은 그 달에 내역이 있을 때만 잠긴다
 * (서버가 응답의 entryManagedCategories로 알려준다).
 */
function lockedCategories(plan: BudgetPlanResponse | null): Set<BudgetCategory> {
  return new Set<BudgetCategory>([
    ...DEPOSIT_CATEGORIES,
    ...(plan?.entryManagedCategories ?? []),
  ]);
}

function amountOrZero(amount: number | null | undefined) {
  return amount ?? 0;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
}

interface Props {
  quarters: QuarterResponse[];
  selectedQuarterId: string;
  onQuarterChange: (id: string) => void;
  quartersLoading: boolean;
}

export function BudgetLedger({
  quarters,
  selectedQuarterId,
  onQuarterChange,
  quartersLoading,
}: Props) {
  const [plans, setPlans] = useState<BudgetPlanResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BudgetPlanResponse | null>(null);
  const [formItems, setFormItems] = useState<BudgetItemRequest[]>([]);
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailDialogCategory, setDetailDialogCategory] = useState<
    "INCOME_STUDY_DEPOSIT" | "EXPENSE_STUDY_DEPOSIT_REFUND" | null
  >(null);
  const [entryDialogCategory, setEntryDialogCategory] = useState<BudgetCategory | null>(null);
  // 항목별로 예상·실제 중 먼저 쓰기 시작한 칸 ("none"이면 따라 쓰기 중단)
  const mirrorSourceRef = useRef<
    Record<number, "plannedAmount" | "actualAmount" | "none" | null>
  >({});
  const [downloading, setDownloading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPlans = useCallback(() => {
    if (!selectedQuarterId) return;
    setLoading(true);
    getBudgetPlansByQuarter(selectedQuarterId)
      .then(setPlans)
      .catch(() => toast.error("예산 계획을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [selectedQuarterId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const currentPlan = plans.find((p) => p.month === selectedMonth) ?? null;

  // 선택된 월의 모든 카테고리 기본 항목 생성
  function buildDefaultItems(): BudgetItemRequest[] {
    const items: BudgetItemRequest[] = [];
    let order = 1;
    CATEGORY_GROUPS.forEach((group) => {
      group.categories.forEach((cat) => {
        items.push({
          category: cat,
          plannedAmount: 0,
          actualAmount: null,
          note: "",
          displayOrder: order++,
        });
      });
    });
    return items;
  }

  function openCreateModal() {
    setEditingPlan(null);
    setFormNote("");
    // 전월 이월금 자동으로 전달 실제 마진 계산
    const defaultItems = buildDefaultItems();
    const prevPlan = plans.find((p) => p.month === selectedMonth - 1);
    if (prevPlan) {
      const carryoverIdx = defaultItems.findIndex(
        (i) => i.category === "INCOME_CARRYOVER",
      );
      if (carryoverIdx !== -1) {
        defaultItems[carryoverIdx].plannedAmount = prevPlan.actualMargin;
        defaultItems[carryoverIdx].actualAmount = prevPlan.actualMargin;
      }
    }
    setFormItems(defaultItems);
    mirrorSourceRef.current = {};
    setModalOpen(true);
  }

  function openEditModal(plan: BudgetPlanResponse) {
    setEditingPlan(plan);
    setFormNote(plan.note ?? "");
    // 기존 항목을 기반으로 모든 카테고리 항목 세팅
    const defaultItems = buildDefaultItems();
    const merged = defaultItems.map((def) => {
      const existing = plan.items.find((i) => i.category === def.category);
      if (existing) {
        return {
          category: existing.category,
          plannedAmount: existing.plannedAmount,
          actualAmount: existing.actualAmount,
          note: existing.note ?? "",
          displayOrder: existing.displayOrder ?? def.displayOrder,
        };
      }
      return def;
    });
    setFormItems(merged);
    mirrorSourceRef.current = {};
    setModalOpen(true);
  }

  async function handleSave() {
    if (!selectedQuarterId) return;
    setSaving(true);
    try {
      // 금액이 0인 항목은 제외
      const filteredItems = formItems.filter(
        (i) => i.plannedAmount !== 0 || (i.actualAmount != null && i.actualAmount !== 0),
      );
      const payload = {
        quarterId: selectedQuarterId,
        month: selectedMonth,
        note: formNote,
        items: filteredItems,
      };
      let saved: BudgetPlanResponse;
      if (editingPlan) {
        saved = await updateBudgetPlan(editingPlan.id, payload);
        setPlans((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        toast.success(`${selectedMonth}월 예산이 수정되었습니다.`);
      } else {
        saved = await createBudgetPlan(payload);
        setPlans((prev) => [...prev, saved].sort((a, b) => a.month - b.month));
        toast.success(`${selectedMonth}월 예산이 생성되었습니다.`);
      }
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan: BudgetPlanResponse) {
    if (!confirm(`${plan.month}월 예산을 삭제하시겠습니까?`)) return;
    try {
      await deleteBudgetPlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      toast.success("삭제되었습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  }

  // 학회비(INCOME_MEMBERSHIP) 입력값이 바뀌면 15% 환급비(EXPENSE_TAX_REFUND)를
  // 자동 계산해서 채워준다. 이후 사용자가 환급비 항목을 직접 수정하면
  // (updateItem이 EXPENSE_TAX_REFUND 항목 자체에 대해 호출되므로) 그 값이 그대로 유지된다.
  function updateItem(
    idx: number,
    field: keyof BudgetItemRequest,
    value: any,
  ) {
    setFormItems((prev) => {
      const changedCategory = prev[idx]?.category;
      const updated = prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      );

      // 예상·실제가 둘 다 비어 있을 때 먼저 쓰기 시작한 칸의 값을 반대쪽에 따라 채운다.
      // 반대쪽 칸을 직접 건드리면 그때부터 따라 쓰기를 멈춘다.
      if (field === "plannedAmount" || field === "actualAmount") {
        const before = prev[idx];
        const other = field === "plannedAmount" ? "actualAmount" : "plannedAmount";
        const bothEmpty =
          amountOrZero(before?.plannedAmount) === 0 &&
          amountOrZero(before?.actualAmount) === 0;
        let source = mirrorSourceRef.current[idx] ?? null;
        if (source === null && bothEmpty) {
          source = field;
        } else if (source !== null && source !== field) {
          source = "none";
        }
        mirrorSourceRef.current[idx] = source;
        if (source === field) {
          updated[idx] = { ...updated[idx], [other]: value };
        }
      }

      if (
        changedCategory === "INCOME_MEMBERSHIP" &&
        (field === "plannedAmount" || field === "actualAmount")
      ) {
        const refundIdx = updated.findIndex(
          (i) => i.category === "EXPENSE_TAX_REFUND",
        );
        if (refundIdx !== -1) {
          if (field === "plannedAmount") {
            updated[refundIdx] = {
              ...updated[refundIdx],
              plannedAmount: -Math.round(Number(value) * 0.15),
            };
          } else if (value != null) {
            updated[refundIdx] = {
              ...updated[refundIdx],
              actualAmount: -Math.round(Number(value) * 0.15),
            };
          }
        }
      }

      return updated;
    });
  }

  // 분기 전체 합계 계산
  const totalIncome = plans.reduce((s, p) => s + p.totalIncome, 0);
  const totalExpense = plans.reduce((s, p) => s + p.totalExpense, 0);
  const totalMargin = plans.reduce((s, p) => s + p.plannedMargin, 0);

  const selectedQuarter = quarters.find((q) => q.id === selectedQuarterId);
  const selectedQuarterName = selectedQuarter?.name ?? "";
  // 분기의 year가 아니라 시작일의 달력 연도를 쓴다 — 겨울학기(예: 2025 WINTER = 2026년 1~2월)는 둘이 다르다
  const startYear = selectedQuarter ? Number(selectedQuarter.startDate?.slice(0, 4)) : NaN;
  const selectedYear = Number.isFinite(startYear) ? startYear : selectedQuarter?.year;

  // 엑셀은 시트 원본과 동일하게 "연도 전체(1~12월)" 단위로 내려받는다.
  async function handleDownloadExcel() {
    if (!selectedYear) return;
    setDownloading(true);
    try {
      const blob = await downloadBudgetExcel(selectedYear);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedYear}년_예산안.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${selectedYear}년 예산안을 다운로드했습니다.`);
    } catch {
      // responseType이 blob이면 에러 본문도 Blob이라 서버 메시지를 꺼낼 수 없다
      toast.error("엑셀 다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 연도 단위 엑셀 내보내기 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedYear
            ? `${selectedYear}년 전체(1~12월) 데이터를 기존 시트 양식으로 내려받을 수 있습니다. 업로드는 여기서 내려받은 파일을 고쳐서 올려주세요.`
            : ""}
        </p>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <ListPlus className="h-3.5 w-3.5 mr-1" />
                상세 내역
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {selectedMonth}월 건별 내역 관리
              </DropdownMenuLabel>
              {CATEGORY_GROUPS.filter((group) => !group.isIncome).map((group) => {
                const categories = group.categories.filter((category) =>
                  DETAIL_MANAGED.has(category),
                );
                if (categories.length === 0) return null;
                return (
                  <div key={group.label}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    {categories.map((category) => (
                      <DropdownMenuItem
                        key={category}
                        onSelect={() => setEntryDialogCategory(category)}
                      >
                        {CATEGORY_LABEL[category]}
                      </DropdownMenuItem>
                    ))}
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            엑셀 업로드
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadExcel}
            disabled={downloading || !selectedYear}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            {downloading ? "다운로드 중..." : "엑셀 다운로드"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              setImportFile(e.target.files?.[0] ?? null);
              // 같은 파일을 고쳐서 다시 골라도 onChange가 오도록 비운다
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* 분기 요약 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              분기 예상 수입
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalIncome)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {selectedQuarterName} · {plans.length}개월 입력
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              분기 예상 지출
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold text-red-500">
                {formatCurrency(totalExpense)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">예상 지출 합계</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              분기 예상 마진
            </CardTitle>
            <Minus className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p
                className={`text-2xl font-bold ${
                  totalMargin >= 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {formatCurrency(totalMargin)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              예상 수입 - 예상 지출
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 월별 탭 + 상세 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">월별 예산 내역</CardTitle>
            <div className="flex items-center gap-2">
              {/* 월 선택 */}
              <div className="flex gap-1 flex-wrap">
                {MONTHS.map((m) => {
                  const hasPlan = plans.some((p) => p.month === m);
                  return (
                    <button
                      key={m}
                      onClick={() => setSelectedMonth(m)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                        selectedMonth === m
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : hasPlan
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {m}월
                    </button>
                  );
                })}
              </div>
              {/* 생성/수정 버튼 */}
              {currentPlan ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(currentPlan)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(currentPlan)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={openCreateModal}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {selectedMonth}월 입력
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !currentPlan ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {selectedMonth}월 예산 내역이 없습니다.
              <br />
              <button
                className="mt-2 text-primary underline underline-offset-2"
                onClick={openCreateModal}
              >
                지금 입력하기
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {CATEGORY_GROUPS.map((group) => {
                const groupItems = currentPlan.items.filter((i) =>
                  group.categories.includes(i.category),
                );
                if (groupItems.length === 0) return null;
                const groupTotal = groupItems.reduce(
                  (s, i) => s + Math.abs(i.plannedAmount),
                  0,
                );
                return (
                  <div key={group.label}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </h4>
                      <span className={`text-xs font-semibold tabular-nums ${group.isIncome ? "text-blue-500" : "text-red-500"}`}>
                        {group.isIncome ? "+" : "-"}
                        {formatCurrency(groupTotal)}
                      </span>
                    </div>
                    <div className="rounded-lg border divide-y">
                      {groupItems.map((item) => {
                        const isDetailed =
                          DEPOSIT_CATEGORIES.has(item.category) ||
                          DETAIL_MANAGED.has(item.category);
                        return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                            isDetailed ? "cursor-pointer hover:bg-muted/50" : ""
                          }`}
                          onClick={
                            DEPOSIT_CATEGORIES.has(item.category)
                              ? () =>
                                  setDetailDialogCategory(
                                    item.category as "INCOME_STUDY_DEPOSIT" | "EXPENSE_STUDY_DEPOSIT_REFUND",
                                  )
                              : DETAIL_MANAGED.has(item.category)
                                ? () => setEntryDialogCategory(item.category)
                                : undefined
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {CATEGORY_LABEL[item.category]}
                            </span>
                            {isDetailed && (
                              <span className="text-xs text-primary underline underline-offset-2">
                                {DEPOSIT_CATEGORIES.has(item.category) ? "상세보기" : "상세 관리"}
                              </span>
                            )}
                            {item.note && (
                              <span className="text-xs text-muted-foreground/60">
                                {item.note}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 tabular-nums">
                            <span className="text-xs text-muted-foreground">
                              예상 {formatCurrency(Math.abs(item.plannedAmount))}
                            </span>
                            {item.actualAmount != null && (
                              <span
                                className={`text-xs font-medium ${
                                  Math.abs(item.actualAmount) <=
                                  Math.abs(item.plannedAmount)
                                    ? "text-green-500"
                                    : "text-red-500"
                                }`}
                              >
                                실제 {formatCurrency(Math.abs(item.actualAmount))}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* 합계 — 예상과 실제를 나란히 본다 (보증금처럼 실제만 채워지는 항목이 있어서) */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">예상 수입 합계</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(currentPlan.totalIncome)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">예상 지출 합계</span>
                  <span className="font-semibold text-red-500">
                    {formatCurrency(currentPlan.totalExpense)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">예상 마진</span>
                  <span
                    className={`font-bold text-lg ${
                      currentPlan.plannedMargin >= 0
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {formatCurrency(currentPlan.plannedMargin)}
                  </span>
                </div>

                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">실제 수입 합계</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(currentPlan.actualIncome)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">실제 지출 합계</span>
                  <span className="font-semibold text-red-500">
                    {formatCurrency(currentPlan.actualExpense)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">실제 마진</span>
                  <span
                    className={`font-bold text-lg ${
                      currentPlan.actualMargin >= 0
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {formatCurrency(currentPlan.actualMargin)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  다음 달 이월금은 이 실제 마진을 가져옵니다.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 입력/수정 모달 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedQuarterName} {selectedMonth}월 예산{" "}
              {editingPlan ? "수정" : "입력"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* 메모 */}
            <div className="space-y-1.5">
              <Label>메모</Label>
              <Textarea
                placeholder="이번 달 특이사항 등 메모를 입력하세요"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                rows={2}
              />
            </div>

            {/* 카테고리 그룹별 입력 */}
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.label}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {group.label}
                </h4>
                <div className="rounded-lg border divide-y">
                  {group.categories.map((cat) => {
                    const idx = formItems.findIndex((i) => i.category === cat);
                    if (idx === -1) return null;
                    const item = formItems[idx];
                    const isAutoSynced = lockedCategories(
                      editingPlan ?? currentPlan,
                    ).has(cat);
                    return (
                      <div
                        key={cat}
                        className="grid grid-cols-[1fr_130px_130px_160px] gap-2 items-center px-3 py-2"
                      >
                        <span className="text-sm text-muted-foreground">
                          {CATEGORY_LABEL[cat]}
                        </span>
                        <Input
                          type="number"
                          placeholder="예상 금액"
                          value={item.plannedAmount === 0 ? "" : Math.abs(item.plannedAmount)}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updateItem(
                              idx,
                              "plannedAmount",
                              group.isIncome ? v : -v,
                            );
                          }}
                          className="h-8 text-sm"
                          disabled={isAutoSynced}
                        />
                        <div>
                          <Input
                            type="number"
                            placeholder="실제 금액"
                            value={
                              item.actualAmount == null || item.actualAmount === 0
                                ? ""
                                : Math.abs(item.actualAmount)
                            }
                            onChange={(e) => {
                              const v = e.target.value === "" ? null : Number(e.target.value);
                              updateItem(
                                idx,
                                "actualAmount",
                                v == null ? null : group.isIncome ? v : -v,
                              );
                            }}
                            className="h-8 text-sm"
                            disabled={isAutoSynced}
                          />
                          {isAutoSynced && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {DEPOSIT_CATEGORIES.has(cat)
                                ? "예상·실제 모두 자동 계산됨 — 신청/수료 처리 시 반영"
                                : "예상·실제 모두 자동 계산됨 — 상세 내역에서 관리"}
                            </p>
                          )}
                        </div>
                        <Input
                          placeholder="메모"
                          value={item.note ?? ""}
                          onChange={(e) =>
                            updateItem(idx, "note", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 15% 환급비 자동계산 안내 */}
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
              💡 15% 환급비는 학회비 금액의 15%로 자동 계산되어 채워집니다. (
              {formatCurrency(
                Math.round(
                  Math.abs(
                    formItems.find((i) => i.category === "INCOME_MEMBERSHIP")
                      ?.plannedAmount ?? 0,
                  ) * 0.15,
                ),
              )}{" "}
              예상) 아래 &quot;15% 환급비&quot; 항목에서 직접 수정할 수도 있습니다.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StudyDepositDetailDialog
        open={detailDialogCategory !== null}
        onOpenChange={(open) => !open && setDetailDialogCategory(null)}
        quarterId={selectedQuarterId}
        month={selectedMonth}
        category={detailDialogCategory ?? "INCOME_STUDY_DEPOSIT"}
      />

      {entryDialogCategory && (
        <ExpenseEntryDialog
          open
          onOpenChange={(open) => !open && setEntryDialogCategory(null)}
          quarterId={selectedQuarterId}
          month={selectedMonth}
          category={entryDialogCategory}
          onChanged={loadPlans}
        />
      )}

      <BudgetImportDialog
        file={importFile}
        onClose={() => setImportFile(null)}
        onApplied={loadPlans}
      />
    </div>
  );
}
