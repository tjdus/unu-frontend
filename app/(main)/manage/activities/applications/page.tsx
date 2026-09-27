"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ActivityManagementNav } from "@/components/custom/activity/activity-management-nav";
import { ActivityStatusBadge } from "@/components/custom/activity/activity-status-badge";
import { ActivityTypeBadge } from "@/components/custom/activity/activity-type-badge";
import { ParticipantStatusBadge } from "@/components/custom/participant/partipant-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getActivityParticipantRefundAccounts,
  getAllActivityParticipants,
} from "@/lib/api/activity-participant";
import { getCurrentQuarter } from "@/lib/api/quarter";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  ActivityParticipantRefundAccount,
  ActivityParticipantResponse,
} from "@/lib/interfaces/activity-participant";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import { activityDisplayStatus } from "@/lib/utils/activity-recruitment";
import { formatDateTime } from "@/lib/utils/date-utils";

type ActivityGroup = {
  activity: ActivityParticipantResponse["activity"];
  participants: ActivityParticipantResponse[];
};

const ACTIVITY_TYPE_OPTIONS = [
  { value: "ALL", label: "전체 유형" },
  { value: "SPECIAL_LECTURE", label: "강의" },
  { value: "LECTURE", label: "인강" },
  { value: "STUDY", label: "스터디" },
  { value: "PROJECT", label: "프로젝트" },
];

const ACTIVITY_TYPE_ORDER: Record<string, number> = {
  SPECIAL_LECTURE: 0,
  LECTURE: 1,
  STUDY: 2,
  PROJECT: 3,
};

function depositLabel(amount: number) {
  return amount > 0 ? `${amount.toLocaleString("ko-KR")}원` : "없음";
}

function promotionConsentLabel(
  depositAmount: number,
  account?: ActivityParticipantRefundAccount,
) {
  if (depositAmount <= 0) return "해당 없음";
  if (!account) return "미확인";
  return account.promotionAgreedAt ? "동의" : "미동의";
}

export default function ActivityApplicationsPage() {
  const router = useRouter();
  const { isLoading: authLoading, userRole } = useAuth();
  const canManageActivities = userRole === "ADMIN" || userRole === "MANAGER";
  const [quarter, setQuarter] = useState<QuarterResponse | null>(null);
  const [participants, setParticipants] = useState<
    ActivityParticipantResponse[]
  >([]);
  const [refundAccounts, setRefundAccounts] = useState<
    Map<string, ActivityParticipantRefundAccount>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activityType, setActivityType] = useState("ALL");

  const openMemberDetail = (memberId: string) => {
    router.push(`/manage/members/${memberId}?from=activity-applications`);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!canManageActivities) {
      router.replace("/home");
      return;
    }

    async function load() {
      try {
        setLoading(true);
        const [currentQuarter, allParticipants] = await Promise.all([
          getCurrentQuarter(),
          getAllActivityParticipants(),
        ]);
        const currentParticipants = allParticipants.filter(
          (participant) =>
            participant.activity?.quarter?.id === currentQuarter.id,
        );
        const depositActivityIds = Array.from(
          new Set(
            currentParticipants
              .filter((participant) => participant.activity.depositAmount > 0)
              .map((participant) => participant.activity.id),
          ),
        );
        const accountResults = await Promise.allSettled(
          depositActivityIds.map((activityId) =>
            getActivityParticipantRefundAccounts(activityId),
          ),
        );
        const accountMap = new Map<
          string,
          ActivityParticipantRefundAccount
        >();
        accountResults.forEach((result) => {
          if (result.status !== "fulfilled") return;
          result.value.forEach((account) =>
            accountMap.set(account.participantId, account),
          );
        });

        setQuarter(currentQuarter);
        setParticipants(currentParticipants);
        setRefundAccounts(accountMap);
      } catch (error) {
        console.error("Failed to load activity applications:", error);
        toast.error("참여 신청 현황을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [authLoading, canManageActivities, router]);

  const groups = useMemo<ActivityGroup[]>(() => {
    const query = search.trim().toLowerCase();
    const filtered = participants.filter((participant) => {
      if (
        activityType !== "ALL" &&
        participant.activity.activityType.code !== activityType
      ) {
        return false;
      }
      if (!query) return true;

      return [
        participant.activity.title,
        participant.user?.name,
        participant.user?.studentId,
      ].some((value) => value?.toLowerCase().includes(query));
    });

    const grouped = new Map<string, ActivityGroup>();
    filtered.forEach((participant) => {
      const activity = participant.activity;
      const current = grouped.get(activity.id);
      if (current) current.participants.push(participant);
      else grouped.set(activity.id, { activity, participants: [participant] });
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        participants: [...group.participants].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      }))
      .sort((a, b) => {
        const typeDifference =
          (ACTIVITY_TYPE_ORDER[a.activity.activityType.code] ?? 99) -
          (ACTIVITY_TYPE_ORDER[b.activity.activityType.code] ?? 99);
        if (typeDifference !== 0) return typeDifference;
        return (b.participants[0]?.createdAt ?? "").localeCompare(
          a.participants[0]?.createdAt ?? "",
        );
      });
  }, [activityType, participants, search]);

  const visibleParticipantCount = new Set(
    groups.flatMap((group) =>
      group.participants.map((participant) => participant.user.id),
    ),
  ).size;

  if (authLoading || loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">활동 관리</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          현재 분기 활동의 참여 신청 현황을 활동별로 확인합니다
        </p>
      </div>

      <ActivityManagementNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{quarter?.name ?? "현재 분기"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {groups.length}개 활동 · {visibleParticipantCount}명
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="활동명, 이름, 학번 검색"
              className="pl-9"
            />
          </div>
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger className="w-full bg-white sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center border-y text-center">
          <UsersRound className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">표시할 참여 신청이 없습니다</p>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 분기의 신청 내역이 생기면 이곳에 활동별로 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ activity, participants: activityParticipants }) => (
            <Card key={activity.id} className="gap-0 overflow-hidden py-0">
              <CardHeader className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ActivityTypeBadge activityType={activity.activityType} />
                      <CardTitle className="truncate text-base">
                        {activity.title}
                      </CardTitle>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      신청·참여 {activityParticipants.length}명 · 보증금 {depositLabel(activity.depositAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ActivityStatusBadge
                      status={activityDisplayStatus(activity)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/manage/activities/${activity.id}?tab=applications`)
                      }
                    >
                      활동에서 관리
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-0">
                <div className="hidden lg:block">
                  <Table className="table-fixed">
                    <TableHeader className="[&_tr]:border-b">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-11 w-[14%] pl-6 text-xs font-semibold text-foreground/70">
                          신청자
                        </TableHead>
                        <TableHead className="h-11 w-[12%] text-xs font-semibold text-foreground/70">
                          학번
                        </TableHead>
                        <TableHead className="h-11 w-[25%] text-xs font-semibold text-foreground/70">
                          환급 계좌번호
                        </TableHead>
                        <TableHead className="h-11 w-[13%] text-center text-xs font-semibold text-foreground/70">
                          홍보 활용
                        </TableHead>
                        <TableHead className="h-11 w-[14%] text-center text-xs font-semibold text-foreground/70">
                          상태
                        </TableHead>
                        <TableHead className="h-11 w-[22%] pr-6 text-right text-xs font-semibold text-foreground/70">
                          신청일
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityParticipants.map((participant) => (
                        <TableRow
                          key={participant.id}
                          className="h-14 cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                          tabIndex={0}
                          aria-label={`${participant.user?.name || "신청자"} 학회원 정보 보기`}
                          onClick={() => openMemberDetail(participant.user.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openMemberDetail(participant.user.id);
                            }
                          }}
                        >
                          <TableCell className="pl-6 font-medium">
                            {participant.user?.name || "—"}
                          </TableCell>
                          <TableCell>{participant.user?.studentId || "—"}</TableCell>
                          <TableCell className="max-w-56 truncate text-muted-foreground">
                            {activity.depositAmount <= 0
                              ? "해당 없음"
                              : refundAccounts.has(participant.id)
                                ? `${refundAccounts.get(participant.id)?.bankName} ${refundAccounts.get(participant.id)?.accountNumber}`
                                : "미등록"}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {promotionConsentLabel(
                              activity.depositAmount,
                              refundAccounts.get(participant.id),
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <ParticipantStatusBadge status={participant.status} />
                          </TableCell>
                          <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                            {formatDateTime(participant.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y lg:hidden">
                  {activityParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="cursor-pointer space-y-3 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      role="button"
                      tabIndex={0}
                      aria-label={`${participant.user?.name || "신청자"} 학회원 정보 보기`}
                      onClick={() => openMemberDetail(participant.user.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openMemberDetail(participant.user.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {participant.user?.name || "—"}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {participant.user?.studentId || "—"}
                          </p>
                        </div>
                        <ParticipantStatusBadge status={participant.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        환급 계좌: {activity.depositAmount <= 0
                          ? "해당 없음"
                          : refundAccounts.has(participant.id)
                            ? `${refundAccounts.get(participant.id)?.bankName} ${refundAccounts.get(participant.id)?.accountNumber}`
                            : "미등록"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        홍보 활용: {promotionConsentLabel(
                          activity.depositAmount,
                          refundAccounts.get(participant.id),
                        )}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(participant.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}
