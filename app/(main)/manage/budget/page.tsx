"use client";

import { useEffect, useState } from "react";
import { BudgetLedger } from "@/components/custom/budget/BudgetLedger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchActivities } from "@/lib/api/activity";
import { getAllQuarters, getCurrentQuarter } from "@/lib/api/quarter";
import { ActivityResponse } from "@/lib/interfaces/activity";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import { Wallet, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

export default function BudgetPage() {
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [quarters, setQuarters] = useState<QuarterResponse[]>([]);
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>("");
  const [loading, setLoading] = useState(true);
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

  // 선택된 분기에 따라 활동 로드
  useEffect(() => {
    if (!selectedQuarterId) return;
    setLoading(true);
    searchActivities({ quarterId: selectedQuarterId })
      .then((data) => setActivities(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedQuarterId]);

  const activitiesWithBudget = activities.filter((a) => a.budget);
  const totalBudget = activitiesWithBudget.reduce(
    (sum, a) => sum + (a.budget ?? 0),
    0,
  );
  const completedBudget = activitiesWithBudget
    .filter((a) => a.status === "COMPLETED")
    .reduce((sum, a) => sum + (a.budget ?? 0), 0);
  const ongoingBudget = activitiesWithBudget
    .filter((a) => a.status === "ONGOING")
    .reduce((sum, a) => sum + (a.budget ?? 0), 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    }).format(amount);

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      CREATED: "준비 중",
      OPEN: "모집 중",
      ONGOING: "진행 중",
      COMPLETED: "완료",
    };
    return map[status] ?? status;
  };

  const getStatusVariant = (
    status: string,
  ): "default" | "secondary" | "destructive" | "outline" => {
    const map: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      CREATED: "secondary",
      OPEN: "default",
      ONGOING: "default",
      COMPLETED: "outline",
    };
    return map[status] ?? "secondary";
  };

  // ── 차트용 데이터 계산 ──────────────────────────────

  // 상태별 예산 분포 (도넛 차트)
  const STATUS_COLORS: Record<string, string> = {
    CREATED: "#94a3b8",
    OPEN: "#3b82f6",
    ONGOING: "#8b5cf6",
    COMPLETED: "#22c55e",
  };

  const statusBudgetMap = activitiesWithBudget.reduce<Record<string, number>>(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + (a.budget ?? 0);
      return acc;
    },
    {},
  );
  const donutSlices = Object.entries(statusBudgetMap).map(([status, amount]) => ({
    status,
    amount,
    label: getStatusLabel(status),
    color: STATUS_COLORS[status] ?? "#e2e8f0",
    pct: totalBudget > 0 ? (amount / totalBudget) * 100 : 0,
  }));

  // 활동 유형별 예산 (가로 막대 차트)
  const typeMap = activitiesWithBudget.reduce<Record<string, { name: string; amount: number }>>(
    (acc, a) => {
      const key = a.activityType?.id ?? "etc";
      const name = a.activityType?.name ?? "기타";
      acc[key] = { name, amount: (acc[key]?.amount ?? 0) + (a.budget ?? 0) };
      return acc;
    },
    {},
  );
  const typeBars = Object.values(typeMap).sort((a, b) => b.amount - a.amount);
  const maxTypeAmount = typeBars[0]?.amount ?? 1;

  const selectedQuarterName =
    quarters.find((q) => q.id === selectedQuarterId)?.name ?? "";

  // ── SVG 도넛 차트 헬퍼 ────────────────────────────────
  function buildDonutPath(
    cx: number,
    cy: number,
    r: number,
    startPct: number,
    endPct: number,
  ) {
    const toRad = (p: number) => ((p / 100) * 2 * Math.PI) - Math.PI / 2;
    const x1 = cx + r * Math.cos(toRad(startPct));
    const y1 = cy + r * Math.sin(toRad(startPct));
    const x2 = cx + r * Math.cos(toRad(endPct));
    const y2 = cy + r * Math.sin(toRad(endPct));
    const large = endPct - startPct > 50 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  const [activeTab, setActiveTab] = useState<"activity" | "ledger">("ledger");

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

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "ledger"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          예산안
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "activity"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          활동별 예산
        </button>
      </div>

      {/* 예산안 탭 */}
      {activeTab === "ledger" && (
        <BudgetLedger
          quarters={quarters}
          selectedQuarterId={selectedQuarterId}
          onQuarterChange={setSelectedQuarterId}
          quartersLoading={quartersLoading}
        />
      )}

      {/* 활동별 예산 탭 */}
      {activeTab === "activity" && (
        <>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 예산
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold">
                {formatCurrency(totalBudget)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {selectedQuarterName} · 예산 등록 {activitiesWithBudget.length}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              진행 중 예산
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(ongoingBudget)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              진행 중인 활동 예산
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              완료된 예산
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(completedBudget)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              완료된 활동 예산
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              예산 미등록
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold text-amber-600">
                {activities.length - activitiesWithBudget.length}개
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              예산이 없는 활동
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 차트 섹션 ── */}
      {!loading && activitiesWithBudget.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 상태별 예산 도넛 차트 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">상태별 예산 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                {/* SVG 도넛 */}
                <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0">
                  {(() => {
                    let cursor = 0;
                    return donutSlices.map((slice) => {
                      const start = cursor;
                      const end = cursor + slice.pct;
                      cursor = end;
                      // 안쪽 원(도넛 구멍)은 흰색 원으로 덮기
                      return (
                        <path
                          key={slice.status}
                          d={buildDonutPath(80, 80, 70, start, end)}
                          fill={slice.color}
                          stroke="white"
                          strokeWidth="2"
                        />
                      );
                    });
                  })()}
                  {/* 가운데 구멍 */}
                  <circle cx="80" cy="80" r="42" fill="white" className="fill-background" />
                  {/* 가운데 텍스트 */}
                  <text x="80" y="76" textAnchor="middle" className="fill-foreground" style={{ fontSize: 11, fontWeight: 600, fill: "currentColor" }}>
                    총 예산
                  </text>
                  <text x="80" y="92" textAnchor="middle" style={{ fontSize: 9, fill: "#6b7280" }}>
                    {activitiesWithBudget.length}개 활동
                  </text>
                </svg>

                {/* 범례 */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {donutSlices.map((slice) => (
                    <div key={slice.status} className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {slice.label}
                      </span>
                      <span className="text-xs font-semibold tabular-nums">
                        {slice.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 활동 유형별 예산 가로 막대 차트 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">활동 유형별 예산</CardTitle>
            </CardHeader>
            <CardContent>
              {typeBars.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">데이터가 없습니다</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {typeBars.map((bar, i) => {
                    const BAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
                    const color = BAR_COLORS[i % BAR_COLORS.length];
                    const widthPct = (bar.amount / maxTypeAmount) * 100;
                    return (
                      <div key={bar.name} className="space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-medium truncate max-w-[60%]">{bar.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(bar.amount)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${widthPct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* 활동별 예산 테이블 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>활동별 예산 현황</CardTitle>
          <span className="text-sm text-muted-foreground">
            {selectedQuarterName}
          </span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activitiesWithBudget.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {`${selectedQuarterName}에 예산이 등록된 활동이 없습니다`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 pr-4 font-medium">활동명</th>
                    <th className="text-left py-3 pr-4 font-medium">유형</th>
                    <th className="text-left py-3 pr-4 font-medium">분기</th>
                    <th className="text-left py-3 pr-4 font-medium">상태</th>
                    <th className="text-right py-3 pr-4 font-medium">예산</th>
                    <th className="text-left py-3 font-medium">예산 메모</th>
                  </tr>
                </thead>
                <tbody>
                  {activitiesWithBudget.map((activity) => (
                    <tr
                      key={activity.id}
                      className="border-b hover:bg-muted/50"
                    >
                      <td className="py-3 pr-4 font-medium">
                        {activity.title}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {activity.activityType?.name ?? "-"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {activity.quarter?.name ?? "-"}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={getStatusVariant(activity.status)}>
                          {getStatusLabel(activity.status)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {formatCurrency(activity.budget ?? 0)}
                      </td>
                      <td className="py-3 text-muted-foreground text-xs">
                        {activity.budgetNote ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={4} className="py-3 pr-4 font-semibold">
                      합계
                    </td>
                    <td className="py-3 pr-4 text-right font-bold text-base">
                      {formatCurrency(totalBudget)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
