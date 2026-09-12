"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createExpenseEntry,
  deleteExpenseEntry,
  getExpenseEntries,
  updateExpenseEntry,
} from "@/lib/api/budget";
import {
  BudgetCategory,
  BudgetExpenseEntryResponse,
  CATEGORY_LABEL,
} from "@/lib/interfaces/budget";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
}

// 서버 오류 응답 본문은 문자열(GlobalExceptionHandler)이거나 { message } 형태다
function errorMessage(e: any, fallback: string): string {
  const data = e?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  return data?.message ?? fallback;
}

interface DraftRow {
  label: string;
  planned: string;
  actual: string;
  occurredAt: string;
  note: string;
}

const EMPTY_DRAFT: DraftRow = {
  label: "",
  planned: "",
  actual: "",
  occurredAt: "",
  note: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quarterId: string;
  month: number;
  category: BudgetCategory;
  /** 등록/수정/삭제로 예산안 금액이 바뀌었을 때 호출 */
  onChanged: () => void;
}

export function ExpenseEntryDialog({
  open,
  onOpenChange,
  quarterId,
  month,
  category,
  onChanged,
}: Props) {
  const [entries, setEntries] = useState<BudgetExpenseEntryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftRow>(EMPTY_DRAFT);
  // 추가 줄에서 예상·실제 중 먼저 쓰기 시작한 칸 ("none"이면 따라 쓰기 중단)
  const [mirrorSource, setMirrorSource] = useState<"planned" | "actual" | "none" | null>(null);
  // 수정 중인 줄 (id → 편집값)
  const [editing, setEditing] = useState<Record<string, DraftRow>>({});

  const load = useCallback(() => {
    if (!quarterId) return;
    setLoading(true);
    getExpenseEntries(quarterId, month, category)
      .then(setEntries)
      .catch((e) => toast.error(errorMessage(e, "상세 내역을 불러오지 못했습니다.")))
      .finally(() => setLoading(false));
  }, [quarterId, month, category]);

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY_DRAFT);
    setMirrorSource(null);
    setEditing({});
    load();
  }, [open, load]);

  const plannedTotal = entries.reduce((s, e) => s + Math.abs(e.plannedAmount), 0);
  const actualTotal = entries.reduce((s, e) => s + Math.abs(e.actualAmount), 0);

  function toRequest(row: DraftRow) {
    return {
      quarterId,
      month,
      category,
      label: row.label.trim(),
      plannedAmount: Number(row.planned || 0),
      actualAmount: Number(row.actual || 0),
      occurredAt: row.occurredAt ? row.occurredAt : null,
      note: row.note.trim() ? row.note.trim() : null,
    };
  }

  async function handleAdd() {
    if (!draft.label.trim()) {
      toast.error("항목명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await createExpenseEntry(toRequest(draft));
      setDraft(EMPTY_DRAFT);
      setMirrorSource(null);
      load();
      onChanged();
      toast.success("내역을 추가했습니다.");
    } catch (e) {
      toast.error(errorMessage(e, "추가에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const row = editing[id];
    if (!row) return;
    if (!row.label.trim()) {
      toast.error("항목명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await updateExpenseEntry(id, toRequest(row));
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      load();
      onChanged();
      toast.success("내역을 수정했습니다.");
    } catch (e) {
      toast.error(errorMessage(e, "수정에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteExpenseEntry(id);
      load();
      onChanged();
      toast.success("내역을 삭제했습니다.");
    } catch (e) {
      toast.error(errorMessage(e, "삭제에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  /**
   * 예상·실제가 둘 다 비어 있을 때 먼저 쓰기 시작한 칸의 값을 반대쪽에 따라 채운다.
   * 반대쪽 칸을 직접 건드리는 순간 따라 쓰기를 멈춘다(그때부터 두 값은 따로 관리).
   */
  function updateDraftAmount(field: "planned" | "actual", value: string) {
    const other = field === "planned" ? "actual" : "planned";
    let source = mirrorSource;
    if (source === null && draft.planned === "" && draft.actual === "") {
      source = field;
      setMirrorSource(field);
    } else if (source !== null && source !== field) {
      source = "none";
      setMirrorSource("none");
    }
    setDraft((prev) => ({
      ...prev,
      [field]: value,
      ...(source === field ? { [other]: value } : {}),
    }));
  }

  function startEdit(entry: BudgetExpenseEntryResponse) {
    setEditing((prev) => ({
      ...prev,
      [entry.id]: {
        label: entry.label,
        planned: String(Math.abs(entry.plannedAmount)),
        actual: String(Math.abs(entry.actualAmount)),
        occurredAt: entry.occurredAt ?? "",
        note: entry.note ?? "",
      },
    }));
  }

  function updateEditing(id: string, field: keyof DraftRow, value: string) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {CATEGORY_LABEL[category]} 상세 내역 · {month}월
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>항목명</TableHead>
                  <TableHead className="w-32 text-right">예상</TableHead>
                  <TableHead className="w-32 text-right">실제</TableHead>
                  <TableHead className="w-36">거래 일자</TableHead>
                  <TableHead className="w-40">비고</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      등록된 내역이 없습니다. 아래에서 추가하세요.
                    </TableCell>
                  </TableRow>
                )}

                {entries.map((entry) => {
                  const row = editing[entry.id];
                  if (!row) {
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.label}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(Math.abs(entry.plannedAmount))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(Math.abs(entry.actualAmount))}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.occurredAt ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.note ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(entry)}
                              disabled={saving}
                            >
                              수정
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(entry.id)}
                              disabled={saving}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Input
                          value={row.label}
                          onChange={(e) => updateEditing(entry.id, "label", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.planned}
                          onChange={(e) => updateEditing(entry.id, "planned", e.target.value)}
                          className="h-8 text-sm text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.actual}
                          onChange={(e) => updateEditing(entry.id, "actual", e.target.value)}
                          className="h-8 text-sm text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.occurredAt}
                          onChange={(e) => updateEditing(entry.id, "occurredAt", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.note}
                          onChange={(e) => updateEditing(entry.id, "note", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleSaveEdit(entry.id)} disabled={saving}>
                            저장
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditing((prev) => {
                                const next = { ...prev };
                                delete next[entry.id];
                                return next;
                              })
                            }
                            disabled={saving}
                          >
                            취소
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* 추가 줄 */}
                <TableRow className="bg-muted/40">
                  <TableCell>
                    <Input
                      placeholder="항목명 (예: dreamhack)"
                      value={draft.label}
                      onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      placeholder="예상"
                      value={draft.planned}
                      onChange={(e) => updateDraftAmount("planned", e.target.value)}
                      className="h-8 text-sm text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      placeholder="실제"
                      value={draft.actual}
                      onChange={(e) => updateDraftAmount("actual", e.target.value)}
                      className="h-8 text-sm text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={draft.occurredAt}
                      onChange={(e) => setDraft({ ...draft, occurredAt: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="비고"
                      value={draft.note}
                      onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={handleAdd} disabled={saving}>
                      추가
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="pt-4 mt-4 sm:justify-between">
          <div className="text-xs text-muted-foreground">
            예상 합계 <span className="font-semibold">{formatCurrency(plannedTotal)}</span> · 실제 합계{" "}
            <span className="font-semibold">{formatCurrency(actualTotal)}</span>
            <br />
            이 합계가 예산안 {month}월의 &lsquo;{CATEGORY_LABEL[category]}&rsquo; 금액이 됩니다.
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
