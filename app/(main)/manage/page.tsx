"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getAllActivitySessions } from "@/lib/api/activity-session";
import { getAllActivities } from "@/lib/api/activity";
import { getAttendancesBySessionId } from "@/lib/api/attendance";
import { ActivitySessionResponseDto } from "@/lib/interfaces/activity-session";
import {
  ActivityResponse,
  ActivityTypeResponse,
} from "@/lib/interfaces/activity";
import { AttendanceResponseDto } from "@/lib/interfaces/attendance";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllActivityTypes } from "@/lib/api/activity-type";

interface EnrichedSession {
  session: ActivitySessionResponseDto;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  STUDY: {
    label: "스터디",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PROJECT: {
    label: "프로젝트",
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  ONLINE_COURSE: {
    label: "온라인 강좌",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  LECTURE: {
    label: "인강",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SPECIAL_LECTURE: {
    label: "강의",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

// Generate color for activity type by index
const getActivityTypeColor = (typeName: string, index: number) => {
  if (CATEGORY_MAP[typeName]) {
    return CATEGORY_MAP[typeName].color;
  }

  const colors = [
    "bg-indigo-600 text-white border-indigo-600",
    "bg-slate-700 text-white border-slate-700",
    "bg-teal-600 text-white border-teal-600",
    "bg-violet-600 text-white border-violet-600",
    "bg-amber-600 text-white border-amber-600",
    "bg-zinc-700 text-white border-zinc-700",
    "bg-stone-700 text-white border-stone-700",
  ];

  return colors[index % colors.length];
};
export default function ManagePage() {
  const router = useRouter();
  const { isAuthenticated, hasRole, isLoading: authLoading } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedActivityTypeIds, setSelectedActivityTypeIds] = useState<
    string[]
  >([]);
  const [sessions, setSessions] = useState<EnrichedSession[]>([]);
  const [selectedSession, setSelectedSession] =
    useState<EnrichedSession | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  // 선택한 세션의 출석 데이터만 lazy load. 페이지 생명주기 동안 세션별로 캐시한다.
  const [selectedSessionAttendances, setSelectedSessionAttendances] = useState<
    AttendanceResponseDto[]
  >([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const attendanceCacheRef = useRef<Map<string, AttendanceResponseDto[]>>(
    new Map(),
  );

  // 특정 세션을 열었을 때만 그 세션의 출석을 1회 조회한다(동일 세션 재오픈 시 캐시 사용).
  useEffect(() => {
    if (!selectedSession) {
      setSelectedSessionAttendances([]);
      return;
    }
    const sessionId = selectedSession.session.id;
    const cached = attendanceCacheRef.current.get(sessionId);
    if (cached) {
      setSelectedSessionAttendances(cached);
      return;
    }
    let cancelled = false;
    setAttendanceLoading(true);
    getAttendancesBySessionId(sessionId)
      .then((data) => {
        if (cancelled) return;
        attendanceCacheRef.current.set(sessionId, data);
        setSelectedSessionAttendances(data);
      })
      .catch(() => {
        if (!cancelled) setSelectedSessionAttendances([]);
      })
      .finally(() => {
        if (!cancelled) setAttendanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSession]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !hasRole("MANAGER"))) {
      router.push("/login");
    }
  }, [isAuthenticated, hasRole, authLoading, router]);

  useEffect(() => {
    if (!isAuthenticated || !hasRole("MANAGER")) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const [sessionsData, activitiesData, activityTypesData] =
          await Promise.all([
            getAllActivitySessions(),
            getAllActivities(),
            getAllActivityTypes(),
          ]);

        // Create activity lookup map
        const activityMap = new Map<string, ActivityResponse>();
        activitiesData.forEach((activity) => {
          activityMap.set(activity.id, activity);
        });

        // 캘린더 표시에는 세션(+임베디드 활동 정보)만 필요하다.
        // 세션별 출석 데이터는 최초 진입 시 불러오지 않고, 특정 세션 상세를 열 때만 lazy load 한다.
        const enrichedSessions = sessionsData.map((session) => ({
          session,
          activity: activityMap.get(session.activity.id) || null,
        }));

        setSessions(enrichedSessions);
        setActivityTypes(activityTypesData);
      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, hasRole]);

  const filteredSessions = sessions.filter((enriched) => {
    // If no filters selected, show all
    if (selectedActivityTypeIds.length === 0) return true;

    // Check if activity's type is in selected filters
    const activityTypeId = enriched.session.activity.activityType.id;
    return activityTypeId
      ? selectedActivityTypeIds.includes(activityTypeId)
      : false;
  });

  const handleActivityTypeToggle = (typeId: string) => {
    setSelectedActivityTypeIds((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId],
    );
  };

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
    );
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  if (authLoading || (loading && isAuthenticated)) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAuthenticated || !hasRole("MANAGER")) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">일정 관리</h1>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          활동 일정과 회차별 출결 현황을 확인합니다
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex shrink-0 items-center gap-1">
            <select
              aria-label="연도 선택"
              className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
              value={currentDate.getFullYear()}
              onChange={(event) => setCurrentDate(new Date(Number(event.target.value), currentDate.getMonth(), 1))}
            >
              {Array.from({ length: 201 }, (_, index) => 1900 + index).map((year) => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select
              aria-label="월 선택"
              className="h-9 w-18 rounded-md border border-input bg-background px-2 text-sm"
              value={currentDate.getMonth()}
              onChange={(event) => setCurrentDate(new Date(currentDate.getFullYear(), Number(event.target.value), 1))}
            >
              {Array.from({ length: 12 }, (_, month) => (
                <option key={month} value={month}>{month + 1}월</option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            오늘
          </Button>
        </div>

        {/* Category Filter */}
        <Card className="p-4">
          <div>
            <div className="flex flex-wrap gap-4">
              {activityTypes.map((type, index) => {
                const isChecked = selectedActivityTypeIds.includes(type.id);
                const categoryColor = getActivityTypeColor(type.code, index);

                return (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type.id}`}
                      checked={isChecked}
                      onCheckedChange={() => handleActivityTypeToggle(type.id)}
                    />
                    <Label
                      htmlFor={`type-${type.id}`}
                      className="cursor-pointer"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          "cursor-pointer transition-all",
                          isChecked && categoryColor,
                        )}
                      >
                        {type.name}
                      </Badge>
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Calendar (full width) */}
      <CalendarView
        currentDate={currentDate}
        sessions={filteredSessions}
        selectedSession={selectedSession}
        onSelectSession={setSelectedSession}
        activityTypes={activityTypes}
      />

      {/* Session Detail Sheet */}
      <Sheet
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
      >
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>상세</SheetTitle>
            <SheetDescription>선택한 일자 상세 정보</SheetDescription>
          </SheetHeader>
          {selectedSession && (
            <SessionDetailPanel
              session={selectedSession}
              attendances={selectedSessionAttendances}
              loading={attendanceLoading}
              onClose={() => setSelectedSession(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Calendar Component
interface CalendarViewProps {
  currentDate: Date;
  sessions: EnrichedSession[];
  selectedSession: EnrichedSession | null;
  onSelectSession: (session: EnrichedSession) => void;
  activityTypes: ActivityTypeResponse[];
}

function CalendarView({
  currentDate,
  sessions,
  selectedSession,
  onSelectSession,
  activityTypes,
}: CalendarViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day and total days in month
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  // Group sessions by date
  const sessionsByDate = new Map<string, EnrichedSession[]>();
  sessions.forEach((enriched) => {
    const date = enriched.session.date;
    if (!sessionsByDate.has(date)) {
      sessionsByDate.set(date, []);
    }
    sessionsByDate.get(date)?.push(enriched);
  });

  const isToday = (day: number) => {
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const formatDate = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  return (
    <Card className="py-0">
      <CardContent className="p-3 sm:p-4">
        {/* Weekday Headers */}
        <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-2">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, idx) => (
            <div
              key={day}
              className={cn(
                "text-center text-sm font-medium py-2",
                idx === 0 && "text-red-600",
                idx === 6 && "text-blue-600",
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid auto-rows-fr grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} aria-hidden="true" />;
            }

            const dateString = formatDate(day);
            const daySessions = sessionsByDate.get(dateString) || [];
            const isSelectedDate = daySessions.some(
              (s) => s.session.id === selectedSession?.session.id,
            );

            return (
              <div
                key={day}
                className={cn(
                  "relative min-h-24 min-w-0 rounded-lg border p-1 sm:min-h-26 sm:p-2",
                  isToday(day) && "bg-primary/5 border-primary font-semibold",
                  isSelectedDate && "ring-2 ring-primary",
                  daySessions.length > 0 && "hover:bg-muted/50 cursor-pointer",
                )}
              >
                <div className="text-sm mb-1">{day}</div>

                {/* Session Indicators */}
                <div className="space-y-1">
                  {daySessions.slice(0, 2).map((enriched) => {
                    const categoryCode =
                      enriched.session.activity?.activityType?.code || "";
                    const typeIndex = activityTypes.findIndex(
                      (t) => t.code === categoryCode,
                    );
                    const categoryColor = getActivityTypeColor(
                      categoryCode,
                      typeIndex,
                    );

                    return (
                      <button
                        key={enriched.session.id}
                        onClick={() => onSelectSession(enriched)}
                        className={cn(
                          "w-full text-left px-1 py-0.5 rounded text-xs truncate border-l-[3px] relative",
                          categoryColor,
                          enriched.session.id === selectedSession?.session.id &&
                            "ring-1 ring-primary",
                        )}
                      >
                        {enriched.session.activity?.title || "활동 진행"}
                      </button>
                    );
                  })}

                  {daySessions.length > 2 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full truncate rounded border border-dashed px-0.5 py-0.5 text-center text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted/50 hover:text-foreground sm:px-1">
                          +{daySessions.length - 2}<span className="sr-only sm:not-sr-only">개 더보기</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm">
                              {formatDate(day)}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              총 {daySessions.length}건
                            </p>
                          </div>
                          <Separator />
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {daySessions.map((enriched) => {
                              const categoryCode =
                                enriched.session.activity?.activityType?.code ||
                                "";
                              const typeIndex = activityTypes.findIndex(
                                (t) => t.code === categoryCode,
                              );
                              const categoryColor = getActivityTypeColor(
                                categoryCode,
                                typeIndex,
                              );

                              return (
                                <button
                                  key={enriched.session.id}
                                  onClick={() => {
                                    onSelectSession(enriched);
                                  }}
                                  className={cn(
                                    "w-full text-left px-2 py-1 rounded text-xs truncate border-l-4 relative hover:bg-muted/50 transition-colors",
                                    categoryColor,
                                  )}
                                >
                                  <div className="font-medium">
                                    {enriched.session.activity?.title ||
                                      "활동 진행"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Session Detail Panel Component
interface SessionDetailPanelProps {
  session: EnrichedSession | null;
  attendances: AttendanceResponseDto[];
  loading: boolean;
  onClose: () => void;
}

function SessionDetailPanel({
  session,
  attendances,
  loading,
}: SessionDetailPanelProps) {
  if (!session) return null;

  const { session: sessionData } = session;
  const categoryCode = session.session.activity?.activityType?.code || "";
  const categoryColor =
    CATEGORY_MAP[categoryCode]?.color ??
    "bg-gray-100 text-gray-700 border-gray-200";

  const attendanceStats = {
    present: attendances.filter((a) => a.status === "PRESENT").length,
    absent: attendances.filter(
      (a) => a.status === "ABSENT" || a.status === "LATE",
    ).length,
    excused: attendances.filter((a) => a.status === "EXCUSED").length,
    total: attendances.length,
  };

  return (
    <div className="space-y-6 p-6 pt-12">
      {/* Title & Badges */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold">
          {session.session.activity?.title || "활동 진행"}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={categoryColor}>
            {CATEGORY_MAP[categoryCode]?.label ?? "기타"}
          </Badge>
          <Badge variant="secondary">{sessionData.sessionNumber} 회차</Badge>
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        {/* Session Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">날짜:</span>
            <span>{sessionData.date}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">참석자:</span>
            <span>
              {attendanceStats.present + attendanceStats.excused} /{" "}
              {attendanceStats.total}
            </span>
          </div>

          {sessionData.description && (
            <div className="text-sm">
              <p className="font-medium mb-1">설명:</p>
              <p className="text-muted-foreground">{sessionData.description}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Attendance Overview */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">출석 현황</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                {attendanceStats.present}
              </div>
              <div className="text-xs text-green-600">출석</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">
                {attendanceStats.excused}
              </div>
              <div className="text-xs text-yellow-600">공결</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700">
                {attendanceStats.absent}
              </div>
              <div className="text-xs text-red-600">결석</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Participant List */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">참가자 목록</h4>
          <ScrollArea className="h-75">
            <div className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  출석 정보를 불러오는 중입니다
                </p>
              ) : attendances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  참가자 정보가 없습니다
                </p>
              ) : (
                attendances.map((attendance) => {
                  const userName =
                    attendance.participant?.user?.name || "이름 없음";
                  const isPresent = attendance.status === "PRESENT";
                  const isExcused = attendance.status === "EXCUSED";
                  const isAbsent =
                    attendance.status === "ABSENT" ||
                    attendance.status === "LATE";

                  return (
                    <div
                      key={attendance.participant.id}
                      className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{userName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPresent && (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            출석
                          </Badge>
                        )}
                        {isExcused && (
                          <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-200"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            공결
                          </Badge>
                        )}
                        {isAbsent && (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 border-red-200"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            결석
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
