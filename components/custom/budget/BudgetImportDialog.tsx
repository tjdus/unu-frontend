"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { previewBudgetImport, applyBudgetImport } from "@/lib/api/budget";
import {
  BudgetImportResult,
  BudgetImportStatus,
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

const STATUS_LABEL: Record<BudgetImportStatus, string> = {
  CREATE: "새로 생성",
  UPDATE: "수정",
  SKIP: "건너뜀",
  ERROR: "오류",
};

const STATUS_VARIANT: Record<
  BudgetImportStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CREATE: "default",
  UPDATE: "secondary",
  SKIP: "outline",
  ERROR: "destructive",
};

interface Props {
  file: File | null;
  onClose: () => void;
  onApplied: () => void;
}

export function BudgetImportDialog({ file, onClose, onApplied }: Props) {
  const [result, setResult] = useState<BudgetImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    setResult(null);
    setLoadError(null);
    setLoading(true);
    previewBudgetImport(file)
      .then(setResult)
      .catch((e) => setLoadError(errorMessage(e, "파일을 읽지 못했습니다.")))
      .finally(() => setLoading(false));
  }, [file]);

  const appliedMonths =
    result?.months.filter((m) => m.status === "CREATE" || m.status === "UPDATE") ?? [];
  const skippedMonths = result?.months.filter((m) => m.status === "SKIP") ?? [];
  const totalChanges = appliedMonths.reduce((s, m) => s + m.changes.length, 0);
  const hasErrors = (result?.errors.length ?? 0) > 0;
  const canApply = !!result && !hasErrors && totalChanges > 0 && !applying;

  async function handleApply() {
    if (!file || !result) return;
    setApplying(true);
    try {
      await applyBudgetImport(file);
      toast.success(`${result.year}년 예산안에 반영했습니다. (변경 ${totalChanges}칸)`);
      onApplied();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "반영에 실패했습니다."));
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && !applying && onClose()}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>엑셀 업로드 미리보기 · {file?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {loading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : result ? (
            <>
              <p className="text-sm text-muted-foreground">
                {result.year > 0 ? `${result.year}년 파일` : "연도 확인 불가"} · 반영{" "}
                {appliedMonths.length}개월 · 변경 {totalChanges}칸 · 건너뜀{" "}
                {skippedMonths.length}개월
              </p>

              {hasErrors && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-1">
                  <p className="font-medium">
                    오류가 있어 반영할 수 없습니다. &lsquo;엑셀 다운로드&rsquo;로 받은 파일을 고쳐서 올려주세요.
                  </p>
                  <ul className="list-disc pl-5">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-medium">확인이 필요한 항목</p>
                  <ul className="list-disc pl-5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {appliedMonths.map((m) => (
                <div key={m.month} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
                    <span className="font-semibold">{m.month}월</span>
                    <Badge variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                    {m.quarterName && (
                      <span className="text-xs text-muted-foreground">{m.quarterName}</span>
                    )}
                  </div>
                  {m.changes.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">바뀌는 값이 없습니다.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>항목</TableHead>
                          <TableHead>구분</TableHead>
                          <TableHead className="text-right">현재</TableHead>
                          <TableHead className="text-right">변경 후</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {m.changes.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell>{c.categoryLabel}</TableCell>
                            <TableCell>{c.field}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatCurrency(c.before)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatCurrency(c.after)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}

              {skippedMonths.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  값이 없어 건너뛴 달: {skippedMonths.map((m) => `${m.month}월`).join(", ")}
                </p>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="pt-4 mt-4">
          {result && !hasErrors && totalChanges === 0 && (
            <span className="mr-auto self-center text-xs text-muted-foreground">
              바뀌는 값이 없어 반영할 내용이 없습니다.
            </span>
          )}
          <Button variant="outline" onClick={onClose} disabled={applying}>
            취소
          </Button>
          <Button onClick={handleApply} disabled={!canApply}>
            {applying ? "반영 중..." : "적용"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
