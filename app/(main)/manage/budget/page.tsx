"use client";

import { useEffect, useState } from "react";
import { BudgetLedger } from "@/components/custom/budget/BudgetLedger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllQuarters, getCurrentQuarter } from "@/lib/api/quarter";
import { QuarterResponse } from "@/lib/interfaces/quarter";

export default function BudgetPage() {
  const [quarters, setQuarters] = useState<QuarterResponse[]>([]);
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>("");
  const [quartersLoading, setQuartersLoading] = useState(true);

  // 분기 목록 로드 + 현재 분기 기본 설정
  useEffect(() => {
    Promise.all([getAllQuarters(), getCurrentQuarter()])
      .then(([allQuarters, currentQuarter]) => {
        setQuarters([...allQuarters].reverse());
        setSelectedQuarterId(currentQuarter.id);
      })
      .catch(console.error)
      .finally(() => setQuartersLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">예산 관리</h1>
          <p className="text-sm text-muted-foreground">
            학회 예산 현황을 확인하고 관리하세요
          </p>
        </div>
        {/* 분기 선택 */}
        <Select
          value={selectedQuarterId}
          onValueChange={setSelectedQuarterId}
          disabled={quartersLoading}
        >
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="분기 선택" />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((quarter) => (
              <SelectItem key={quarter.id} value={quarter.id}>
                {quarter.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BudgetLedger
        quarters={quarters}
        selectedQuarterId={selectedQuarterId}
        onQuarterChange={setSelectedQuarterId}
        quartersLoading={quartersLoading}
      />
    </div>
  );
}
