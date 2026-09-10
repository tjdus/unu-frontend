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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getStudyDepositLedgerEntries } from "@/lib/api/budget";
import {
  StudyDepositLedgerEntryResponse,
  CATEGORY_LABEL,
} from "@/lib/interfaces/budget";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

type DepositCategory = "INCOME_STUDY_DEPOSIT" | "EXPENSE_STUDY_DEPOSIT_REFUND";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quarterId: string;
  month: number;
  category: DepositCategory;
}

export function StudyDepositDetailDialog({
  open,
  onOpenChange,
  quarterId,
  month,
  category,
}: Props) {
  const [entries, setEntries] = useState<StudyDepositLedgerEntryResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !quarterId) return;
    setLoading(true);
    getStudyDepositLedgerEntries(quarterId, month, category)
      .then(setEntries)
      .catch(() => toast.error("상세 내역을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [open, quarterId, month, category]);

  const total = entries.reduce((s, e) => s + Math.abs(e.amount), 0);

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
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              해당 월에 신규 내역이 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>활동명</TableHead>
                  <TableHead>참여자명</TableHead>
                  <TableHead>학번</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.activityTitle}</TableCell>
                    <TableCell>{e.userName}</TableCell>
                    <TableCell>{e.studentId ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Math.abs(e.amount))}
                    </TableCell>
                    <TableCell>{formatDateTime(e.occurredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter className="pt-4 mt-4">
          <div className="text-sm text-muted-foreground">
            총 {entries.length}건 · 합계 {formatCurrency(total)}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
