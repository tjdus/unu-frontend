"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, Search, UserX } from "lucide-react";
import { toast } from "sonner";
import { getMemberActivitySummaries, removeUsers } from "@/lib/api/user";
import { useAuth } from "@/lib/contexts/AuthContext";
import { MemberActivityPolicyStatus, MemberActivitySummary } from "@/lib/interfaces/member-activity";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const PAGE_SIZE = 10;
const POLICY_LABELS: Record<MemberActivityPolicyStatus, string> = {
  FULFILLED: "충족",
  WITHIN_PERIOD: "기한 내 미충족",
  REMOVAL_TARGET: "퇴출 대상",
  CHECK_REQUIRED: "확인 필요",
};
const POLICY_ORDER: Record<MemberActivityPolicyStatus, number> = {
  REMOVAL_TARGET: 0, CHECK_REQUIRED: 1, WITHIN_PERIOD: 2, FULFILLED: 3,
};
const POLICY_STYLES: Record<MemberActivityPolicyStatus, string> = {
  FULFILLED: "border-green-200 bg-green-50 text-green-700",
  WITHIN_PERIOD: "border-border text-muted-foreground",
  REMOVAL_TARGET: "border-red-200 bg-red-50 text-red-700",
  CHECK_REQUIRED: "border-amber-200 bg-amber-50 text-amber-700",
};

function quarterLabel(value: string | null) {
  return value ? value.replace(/^(\d{2})(\d{2}) /, "$2 ")
    .replace(/\b(WINTER|SPRING|SUMMER|FALL)\b/g, (season) => season[0] + season.slice(1).toLowerCase()) : "—";
}

function PolicyBadge({ member }: { member: MemberActivitySummary }) {
  return <Badge variant="outline" className={POLICY_STYLES[member.policyStatus]}>{POLICY_LABELS[member.policyStatus]}</Badge>;
}

export function MemberActivityTab({ quarters, refreshToken, onRemoved }: { quarters: QuarterResponse[]; refreshToken: number; onRemoved: () => void }) {
  const { hasRole, userId } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const [members, setMembers] = useState<MemberActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MemberActivitySummary | null>(null);
  const [removalTarget, setRemovalTarget] = useState<MemberActivitySummary | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getMemberActivitySummaries()
      .then((data) => {
        if (cancelled) return;
        setMembers(data);
        setSelected(null);
        setPage(1);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload, refreshToken]);

  const filtered = members.filter((member) => {
    const search = query.trim().toLocaleLowerCase();
    return (member.policyStatus === "REMOVAL_TARGET" || member.policyStatus === "WITHIN_PERIOD")
      && (quarterFilter === "ALL" || member.joinedQuarterId === quarterFilter)
      && (statusFilter === "ALL" || member.policyStatus === statusFilter)
      && (!search || member.name.toLocaleLowerCase().includes(search) || member.studentId.includes(search));
  }).sort((a, b) => POLICY_ORDER[a.policyStatus] - POLICY_ORDER[b.policyStatus]
    || a.name.localeCompare(b.name, "ko") || a.studentId.localeCompare(b.studentId));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleMembers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleRemove() {
    if (!removalTarget || removing || !isAdmin || removalTarget.userId === userId) return;
    setRemoving(true);
    try {
      await removeUsers([removalTarget.userId]);
      setMembers((current) => current.filter((member) => member.userId !== removalTarget.userId));
      setSelected((current) => current?.userId === removalTarget.userId ? null : current);
      setRemovalTarget(null);
      toast.success(`${removalTarget.name} 학회원을 퇴출했습니다.`);
      onRemoved();
    } catch (error) {
      const message = (error as { response?: { data?: unknown } })?.response?.data;
      toast.error(typeof message === "string" && message.trim() ? message : "학회원을 퇴출하지 못했습니다.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>퇴출 관리</CardTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>총 {loading ? "—" : filtered.length}명</span>
              <Button type="button" variant="ghost" size="icon-sm" title="활동 기록 새로고침" aria-label="활동 기록 새로고침" disabled={loading} onClick={() => setReload((value) => value + 1)}><RotateCw className="size-4" /></Button>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            퇴출 조건 : 가입 분기 활동 미수료 or 가입 분기 포함 이후 4개 분기 내 2개 분기 미만 활동
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="학회원 이름 또는 학번 검색" placeholder="이름 또는 학번 검색" className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
            </div>
            <Select value={quarterFilter} onValueChange={(value) => { setQuarterFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="가입 분기" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 가입 분기</SelectItem>
                {quarters.map((quarter) => <SelectItem key={quarter.id} value={quarter.id}>{quarterLabel(quarter.name)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="정책 상태" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 대상</SelectItem>
                <SelectItem value="REMOVAL_TARGET">퇴출 대상</SelectItem>
                <SelectItem value="WITHIN_PERIOD">기한 내 미충족</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
            : error ? <div className="flex flex-col items-center gap-4 py-12"><p className="text-sm text-muted-foreground">활동 기록을 불러오지 못했습니다.</p><Button variant="outline" onClick={() => setReload((value) => value + 1)}>다시 시도</Button></div>
            : filtered.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">조건에 맞는 학회원이 없습니다.</p>
            : <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>학회원</TableHead><TableHead>가입 분기</TableHead>
                  <TableHead className="text-center">누적 수료</TableHead>
                  <TableHead className="text-center">가입 분기 활동 수료</TableHead>
                  <TableHead className="text-center">수료 인정 분기</TableHead>
                  <TableHead>평가 기한</TableHead><TableHead>정책 상태</TableHead>
                  {isAdmin && <TableHead className="text-right">관리</TableHead>}
                </TableRow></TableHeader>
                <TableBody>{visibleMembers.map((member) => <TableRow key={member.userId}>
                  <TableCell><button type="button" className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelected(member)}>{member.name}<span className="mt-1 block text-xs font-normal text-muted-foreground">{member.studentId}</span></button></TableCell>
                  <TableCell>{quarterLabel(member.joinedQuarterName)}</TableCell>
                  <TableCell className="text-center tabular-nums">{member.totalCompletedCount}회</TableCell>
                  <TableCell className={`text-center ${member.joinedQuarterCompletedCount > 0 ? "text-green-700" : "text-muted-foreground"}`}>{member.joinedQuarterCompletedCount > 0 ? "충족" : "미충족"}</TableCell>
                  <TableCell className="text-center tabular-nums">{member.evaluationCompletedQuarterCount} / 2개 분기</TableCell>
                  <TableCell>{member.evaluationEndQuarterName ? `${quarterLabel(member.evaluationEndQuarterName)}까지` : "—"}</TableCell>
                  <TableCell><PolicyBadge member={member} /></TableCell>
                  {isAdmin && <TableCell className="text-right"><Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={removing || member.userId === userId} onClick={() => setRemovalTarget(member)}><UserX className="size-4" />퇴출</Button></TableCell>}
                </TableRow>)}</TableBody>
              </Table>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">퇴출 대상은 활동 기록을 기준으로 판정합니다. 실제 퇴출은 관리자가 퇴출 버튼을 눌러 처리합니다.</p>
              {pages > 1 && <div className="mt-5 flex items-center justify-center gap-3 border-t pt-5">
                <Button variant="outline" size="icon-sm" aria-label="이전 페이지" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
                <span className="min-w-16 text-center text-sm text-muted-foreground">{currentPage} / {pages}</span>
                <Button variant="outline" size="icon-sm" aria-label="다음 페이지" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
              </div>}
            </>}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85svh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name}의 수료 활동</DialogTitle><DialogDescription>{selected?.studentId} · 가입 분기 {quarterLabel(selected?.joinedQuarterName ?? null)}</DialogDescription></DialogHeader>
          {selected && <>
            <div className="space-y-3 border-b pb-4"><PolicyBadge member={selected} /><p className="text-sm leading-6">{selected.policyReason}</p><p className="text-xs text-muted-foreground">가입 분기 종료: {selected.joinedQuarterEndDate || "정보 없음"} · 4개 분기 평가 기한: {selected.evaluationEndQuarterName ? `${quarterLabel(selected.evaluationEndQuarterName)}까지` : "—"}</p></div>
            {selected.completedActivities.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">수료한 활동이 없습니다.</p>
              : <ul className="divide-y">{selected.completedActivities.map((activity) => <li key={activity.activityId} className="space-y-2 py-4">
                <p className="break-words font-medium">{activity.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{quarterLabel(activity.quarterName)}</span>{activity.joinedQuarter && <Badge variant="outline">가입 분기</Badge>}{activity.evaluationPeriod ? <Badge variant="outline">4개 분기 집계 포함</Badge> : <span>4개 분기 집계 제외</span>}</div>
              </li>)}</ul>}
          </>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={removalTarget !== null} onOpenChange={(open) => { if (!open && !removing) setRemovalTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removalTarget?.name} 학회원을 퇴출하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>{removalTarget?.name} ({removalTarget?.studentId})</p>
                <p>{removalTarget?.policyReason}</p>
                {removalTarget?.policyStatus === "WITHIN_PERIOD" && <p className="font-medium text-destructive">아직 활동 인정 기한이 남아 있습니다. 퇴출 여부를 다시 확인해주세요.</p>}
                <p>퇴출하면 로그인할 수 없으며 학회원 목록에서 제외됩니다. 기존 활동 및 수료 기록은 보존됩니다.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>취소</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={removing} onClick={(event) => { event.preventDefault(); void handleRemove(); }}>{removing ? "퇴출 처리 중…" : "퇴출"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
