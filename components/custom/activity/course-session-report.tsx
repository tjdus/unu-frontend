"use client";

import { useState, useEffect, useCallback } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityParticipantResponse } from "@/lib/interfaces/activity-participant";
import { ChronologicalActivitySession } from "@/lib/interfaces/activity-session";
import { AttendanceResponseDto } from "@/lib/interfaces/attendance";
import { AttendanceReportResponse } from "@/lib/interfaces/attendance-report";
import { getActivitySessionsByActivityId } from "@/lib/api/activity-session";
import { getAttendancesByParticipantId } from "@/lib/api/attendance";
import {
  createAttendanceReport,
  getAttendanceReportByAttendanceId,
} from "@/lib/api/attendance-report";

// ========================
// HELPERS
// ========================

type SubmitStatus = "PRESENT" | "ABSENT";

function getSubmitStatus(sessionDate: string): SubmitStatus {
  const daysLate = differenceInDays(new Date(), parseISO(sessionDate));
  if (daysLate <= 0) return "PRESENT";
  return "ABSENT";
}

interface StatusMeta {
  label: string;
  className: string;
}

function getStatusMeta(status: string): StatusMeta {
  switch (status) {
    case "PRESENT":
      return {
        label: "출석",
        className: "bg-green-50 text-green-700 border-green-200",
      };
    case "LATE":
    case "ABSENT":
      return {
        label: "결석",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    default:
      return {
        label: "미제출",
        className: "bg-slate-50 text-slate-600 border-slate-200",
      };
  }
}

// ========================
// TYPES
// ========================

interface SessionRow {
  session: ChronologicalActivitySession;
  attendance: AttendanceResponseDto | null;
  report: AttendanceReportResponse | null;
  submitStatus: SubmitStatus; // what status would be assigned if submitted now
}

// ========================
// MAIN COMPONENT
// ========================

interface CourseSessionReportCardProps {
  activityId: string;
  myParticipant: ActivityParticipantResponse | null;
}

export function CourseSessionReportCard({
  activityId,
  myParticipant,
}: CourseSessionReportCardProps) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogSession, setDialogSession] =
    useState<ChronologicalActivitySession | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded report view
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessions = await getActivitySessionsByActivityId(activityId);

      // Fetch attendance only after participation is confirmed.
      let myAttendances: AttendanceResponseDto[] = [];
      if (myParticipant?.status === "APPROVED") {
        try {
          myAttendances = await getAttendancesByParticipantId(myParticipant.id);
        } catch {
          myAttendances = [];
        }
      }

      // Build rows: match attendance to session, then fetch reports
      const built: SessionRow[] = await Promise.all(
        sessions.map(async (session) => {
          const attendance =
            myAttendances.find((a) => a.session.id === session.id) ?? null;
          let report: AttendanceReportResponse | null = null;
          if (attendance) {
            report = await getAttendanceReportByAttendanceId(attendance.id);
          }
          return {
            session,
            attendance,
            report,
            submitStatus: getSubmitStatus(session.date),
          };
        }),
      );

      setRows(built);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activityId, myParticipant]);

  useEffect(() => {
    load();
  }, [load]);

  const openDialog = (session: ChronologicalActivitySession) => {
    setDialogSession(session);
    setTitle("");
    setContent("");
    setError(null);
  };

  const closeDialog = () => {
    setDialogSession(null);
    setTitle("");
    setContent("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (
      !dialogSession ||
      myParticipant?.status !== "APPROVED" ||
      !title.trim() ||
      !content.trim()
    )
      return;

    setSubmitting(true);
    setError(null);
    try {
      await createAttendanceReport({
        sessionId: dialogSession.id,
        participantId: myParticipant.id,
        title,
        content,
      });
      await load();
      closeDialog();
    } catch {
      setError("보고서 제출에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-md font-semibold">출석 보고서</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              등록된 세션이 없습니다
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map(({ session, report, submitStatus }) => {
                const submitted = !!report;
                const canSubmit = !submitted && submitStatus !== "ABSENT";
                const isExpanded = expandedSessionId === session.id;
                const displayStatus = submitted
                  ? report.attendanceStatus
                  : submitStatus === "ABSENT"
                    ? "ABSENT"
                    : null;
                const statusMeta = displayStatus
                  ? getStatusMeta(displayStatus)
                  : null;

                return (
                  <div key={session.id} className="rounded-md border">
                    {/* Row header */}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium shrink-0">
                            {session.displayNumber}회차
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(
                              parseISO(session.date),
                              "yyyy.MM.dd (eee)",
                              {
                                locale: ko,
                              },
                            )}
                          </span>
                          {statusMeta && (
                            <Badge
                              variant="outline"
                              className={cn("text-xs", statusMeta.className)}
                            >
                              {statusMeta.label}
                            </Badge>
                          )}
                          {submitted && (
                            <span className="text-xs text-muted-foreground">
                              제출 완료
                            </span>
                          )}
                        </div>
                        {session.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {session.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {submitted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setExpandedSessionId(
                                isExpanded ? null : session.id,
                              )
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {canSubmit && myParticipant?.status === "APPROVED" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            onClick={() => openDialog(session)}
                          >
                            보고서 작성
                          </Button>
                        )}
                        {canSubmit && myParticipant?.status !== "APPROVED" && (
                          <span className="text-xs text-muted-foreground">
                            {myParticipant?.status === "APPLIED"
                              ? "활동 시작 후 이용 가능"
                              : "참여 신청 필요"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded report content */}
                    {submitted && isExpanded && report && (
                      <div className="border-t px-3 py-3 space-y-1 bg-muted/30">
                        <p className="text-xs font-semibold">{report.title}</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {report.content}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report write dialog */}
      <Dialog
        open={!!dialogSession}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogSession?.displayNumber}회차 보고서 작성
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Session info */}
            {dialogSession && (
              <div className="rounded-md bg-muted/50 px-3 py-2.5 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  마감일:{" "}
                  {format(parseISO(dialogSession.date), "yyyy.MM.dd (eee)", {
                    locale: ko,
                  })}
                </p>
                {dialogSession.description && (
                  <p className="text-xs text-muted-foreground">
                    {dialogSession.description}
                  </p>
                )}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">제목</label>
              <Input
                placeholder="보고서 제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">내용</label>
              <Textarea
                placeholder="보고서 내용을 작성하세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-36 resize-none"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              취소
            </Button>
            <Button
              disabled={!title.trim() || !content.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "제출 중..." : "제출"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
