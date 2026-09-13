"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchActivities } from "@/lib/api/activity";
import { getMyActivityParticipants } from "@/lib/api/activity-participant";
import { getAllActivityTypes } from "@/lib/api/activity-type";
import { getCurrentQuarter } from "@/lib/api/quarter";
import { getCurrentActivityOpeningPeriod } from "@/lib/api/activity-opening-period";
import { ActivityOpeningPeriodResponse } from "@/lib/interfaces/activity-opening-period";
import {
  ActivityResponse,
  ActivityTypeResponse,
} from "@/lib/interfaces/activity";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils/date-utils";
import {
  activityRecruitmentDeadlineLabel,
  activityDisplayStatus,
  isActivityRecruiting as isRecruiting,
} from "@/lib/utils/activity-recruitment";
import { ActivityStatusBadge } from "@/components/custom/activity/activity-status-badge";
import { ActivityTypeBadge } from "@/components/custom/activity/activity-type-badge";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMenuNotification } from "@/lib/contexts/MenuNotificationContext";

// ========================
// ACTIVITY ROW COMPONENT
// ========================

interface ActivityRowProps {
  activity: ActivityResponse;
  participantStatus?: string;
  isNew: boolean;
  onClick: (id: string) => void;
}

function getActionLabel(
  activity: ActivityResponse,
  participantStatus?: string,
): string {
  if (activity.status === "COMPLETED") return "종료";
  if (participantStatus === "APPLIED") return "신청 완료";
  if (participantStatus === "APPROVED") return "참여 중";
  if (participantStatus === "REJECTED") {
    return isRecruiting(activity) ? "다시 신청" : "보기";
  }
  return isRecruiting(activity) ? "참여 신청" : "보기";
}

function ActivityRow({
  activity,
  participantStatus,
  isNew,
  onClick,
}: ActivityRowProps) {
  const isClosed = activity.status === "COMPLETED";
  const canApply = isRecruiting(activity) && participantStatus !== "APPLIED" &&
    participantStatus !== "APPROVED";

  return (
    <div
      className="flex cursor-pointer flex-col items-stretch gap-2 rounded-lg border bg-card px-4 py-3 transition-all hover:border-slate-300 hover:shadow-sm lg:flex-row lg:items-center lg:gap-3"
      onClick={() => onClick(activity.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(activity.id);
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0">
            <ActivityTypeBadge activityType={activity.activityType} />
          </span>
          {isNew && (
            <Badge className="shrink-0 border-red-200 bg-red-50 text-[10px] font-semibold text-red-600 hover:bg-red-50">
              신규
            </Badge>
          )}
          <span className="truncate text-sm font-semibold">
            {activity.title}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="flex shrink-0 items-center gap-1">
            <User className="h-3 w-3" />
            <span className="max-w-24 truncate">
              {activity.assignee.name}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(activity.startDate)} ~ {formatDate(activity.endDate)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <ActivityStatusBadge
          status={activityDisplayStatus(activity)}
          detail={activityRecruitmentDeadlineLabel(activity)}
        />

        <Button
          size="sm"
          variant={canApply ? "default" : "outline"}
          disabled={isClosed}
          className="hidden h-8 shrink-0 lg:inline-flex"
          onClick={(e) => {
            e.stopPropagation();
            onClick(activity.id);
          }}
        >
          <span className="text-xs">
            {getActionLabel(activity, participantStatus)}
          </span>
        </Button>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground lg:hidden" />
      </div>
    </div>
  );
}

// ========================
// MAIN COMPONENT
// ========================

const ACTIVITIES_PER_PAGE = 20;
const ACTIVITY_TYPE_ORDER: Record<string, number> = {
  SPECIAL_LECTURE: 0,
  PROJECT: 1,
  STUDY: 2,
  LECTURE: 3,
};

function acceptsParticipantApplications(activity: ActivityResponse): boolean {
  return Boolean(
    activity.recruitmentStartDate && activity.recruitmentEndDate,
  );
}

function formatQuarterLabel(quarter: QuarterResponse): string {
  const season = quarter.season.toLowerCase();
  const formattedSeason = season.charAt(0).toUpperCase() + season.slice(1);
  return `${String(quarter.year).slice(-2)} ${formattedSeason}`;
}

const ActivityPage = () => {
  const router = useRouter();
  const { newActivityIds } = useMenuNotification();
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeResponse[]>(
    [],
  );
  const [currentQuarterId, setCurrentQuarterId] = useState<string>("");
  const [currentQuarterLabel, setCurrentQuarterLabel] = useState<string>("");
  const [openingPeriod, setOpeningPeriod] =
    useState<ActivityOpeningPeriodResponse | null>(null);
  const [openingPeriodLoaded, setOpeningPeriodLoaded] = useState(false);
  const [participantStatusByActivity, setParticipantStatusByActivity] =
    useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [typesData, currentQuarter] = await Promise.all([
          getAllActivityTypes(),
          getCurrentQuarter(),
        ]);
        setActivityTypes(typesData);
        setCurrentQuarterId(currentQuarter.id);
        setCurrentQuarterLabel(formatQuarterLabel(currentQuarter));
      } catch (error: unknown) {
        console.error("Failed to fetch initial data:", error);
        toast.error(
          "데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    getCurrentActivityOpeningPeriod()
      .then(setOpeningPeriod)
      .catch(() => setOpeningPeriod(null))
      .finally(() => setOpeningPeriodLoaded(true));
  }, []);

  useEffect(() => {
    getMyActivityParticipants()
      .then((participations) =>
        setParticipantStatusByActivity(
          Object.fromEntries(
            participations
              .filter((participation) => participation.activity?.id)
              .map((participation) => [
                participation.activity.id,
                participation.status,
              ]),
          ),
        ),
      )
      .catch((error) => {
        console.error("Failed to fetch my participations:", error);
      });
  }, []);

  useEffect(() => {
    if (!currentQuarterId) return;
    const fetchActivities = async () => {
      setLoading(true);
      try {
        const data = await searchActivities({
          title: searchTerm || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          activityTypeId:
            activityTypeFilter !== "all" ? activityTypeFilter : undefined,
          quarterId: currentQuarterId,
        });
        setActivities(data.filter(acceptsParticipantApplications));
      } catch (error: unknown) {
        console.error("Failed to fetch activities:", error);
        toast.error(
          "활동 데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
        setActivities([]);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };
    fetchActivities();
  }, [activityTypeFilter, statusFilter, searchTerm, currentQuarterId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activityTypeFilter, statusFilter, searchTerm, currentQuarterId]);

  const totalPages = Math.max(
    1,
    Math.ceil(activities.length / ACTIVITIES_PER_PAGE),
  );
  const sortedActivities = useMemo(
    () =>
      [...activities].sort((a, b) => {
        const recruitDiff = Number(isRecruiting(b)) - Number(isRecruiting(a));
        if (recruitDiff !== 0) return recruitDiff;
        return (
          (ACTIVITY_TYPE_ORDER[a.activityType.code] ??
            Number.MAX_SAFE_INTEGER) -
          (ACTIVITY_TYPE_ORDER[b.activityType.code] ?? Number.MAX_SAFE_INTEGER)
        );
      }),
    [activities],
  );
  const paginatedActivities = sortedActivities.slice(
    (currentPage - 1) * ACTIVITIES_PER_PAGE,
    currentPage * ACTIVITIES_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleClearFilters = () => {
    setActivityTypeFilter("all");
    setStatusFilter("all");
    setSearchInput("");
    setSearchTerm("");
  };

  const hasFilters =
    activityTypeFilter !== "all" || statusFilter !== "all" || searchTerm !== "";

  const openingPeriodMessage = (() => {
    if (!openingPeriod) {
      return openingPeriodLoaded
        ? "활동 개설 신청 기간을 확인할 수 없습니다."
        : "활동 개설 신청 기간을 확인하는 중입니다.";
    }
    if (openingPeriod.status === "OPEN" && openingPeriod.endAt) {
      return `${new Date(openingPeriod.endAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}까지 개설 신청을 받습니다.`;
    }
    if (openingPeriod.status === "UPCOMING" && openingPeriod.startAt) {
      return `${new Date(openingPeriod.startAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}부터 개설 신청이 가능합니다.`;
    }
    if (openingPeriod.status === "CLOSED") return "이번 분기 활동 개설 신청이 마감되었습니다.";
    if (openingPeriod.status === "DISABLED") return "현재 활동 개설 신청 접수가 중지되어 있습니다.";
    return "활동 개설 신청 기간이 아직 설정되지 않았습니다.";
  })();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">학회 활동</h1>
        <p className="text-sm text-muted-foreground">
          {currentQuarterLabel
            ? `${currentQuarterLabel} 분기에 개설된 활동을 확인하고 참여하세요`
            : "현재 분기에 개설된 활동을 확인하고 참여하세요"}
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex items-center w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="활동 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearchTerm(searchInput);
              }}
              className="pl-9 h-9"
            />
          </div>

          <Select
            value={activityTypeFilter}
            onValueChange={setActivityTypeFilter}
          >
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs">
              <SelectValue placeholder="전체 유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                전체 유형
              </SelectItem>
              {activityTypes.map((type) => (
                <SelectItem key={type.id} value={type.id} className="text-xs">
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                전체 상태
              </SelectItem>
              <SelectItem value="OPEN" className="text-xs">
                모집 중
              </SelectItem>
              <SelectItem value="ONGOING" className="text-xs">
                진행 중
              </SelectItem>
              <SelectItem value="COMPLETED" className="text-xs">
                종료
              </SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              onClick={handleClearFilters}
              variant="ghost"
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              초기화
            </Button>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/activity-opening/my")}
          >
            <span className="text-xs">내 개설 신청</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            title={openingPeriodMessage}
            disabled={!openingPeriod?.canApply}
            onClick={() => router.push("/activity-opening/apply")}
          >
            <Plus className="h-3 w-3" />
            <span className="text-xs">
              {openingPeriod?.status === "CLOSED" ? "신청 마감" : openingPeriod?.status === "UPCOMING" ? "신청 기간이 아닙니다" : "활동 개설 신청"}
            </span>
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && initialLoad && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 10 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
              <Skeleton className="hidden h-8 w-16 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      )}

      {/* Empty: no activities */}
      {!loading && activities.length === 0 && !hasFilters && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              이번 분기 활동이 없습니다
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty: filtered */}
      {!loading && activities.length === 0 && hasFilters && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              조건에 맞는 활동이 없습니다
            </p>
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <p className="text-sm text-muted-foreground">필터 초기화</p>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Activity list */}
      {!loading && activities.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {paginatedActivities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              participantStatus={participantStatusByActivity[activity.id]}
              isNew={newActivityIds.includes(activity.id)}
              onClick={(id) => router.push(`/activities/${id}`)}
            />
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t pt-5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="이전 페이지"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-16 text-center text-sm font-medium text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="다음 페이지"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActivityPage;
