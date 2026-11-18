"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft,
  Mail,
  Copy,
  Check,
  BookOpen,
  GraduationCap,
  Phone,
  CalendarDays,
  Info,
  Code2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONES } from "@/lib/constants/status-badge-tones";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getApplicationById,
  importApplicationLectureRoomSchedule,
  reviewApplication,
} from "@/lib/api/application";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApplicationResponse } from "@/lib/interfaces/application";
import { formatDateTime } from "@/lib/utils/date-utils";
import ApplicationStatusDropdown from "@/components/custom/application/application-status-dropdown";
import { toast } from "sonner";

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm font-medium">{value || "—"}</div>
      </div>
    </div>
  );
}

interface FormQuestion {
  id: string;
  type: string;
  title?: string;
  label?: string;
  required?: boolean;
}

interface FormSnapshot {
  version?: number;
  questions?: FormQuestion[];
}

const LECTURE_ROOM_DAYS = [
  { title: "월요일관리가능한시간", label: "월요일" },
  { title: "화요일관리가능한시간", label: "화요일" },
  { title: "수요일관리가능한시간", label: "수요일" },
  { title: "목요일관리가능한시간", label: "목요일" },
  { title: "금요일관리가능한시간", label: "금요일" },
];

interface LectureRoomAvailability {
  label: string;
  options: string[];
}

function getLectureRoomAvailability(
  snapshot: FormSnapshot | null,
  answers: Record<string, unknown>,
): LectureRoomAvailability[] | null {
  if (!snapshot?.questions) return null;

  const questionsByTitle = new Map(
    snapshot.questions.map((question) => [
      (question.title || question.label || "").replace(/\s+/g, ""),
      question,
    ]),
  );

  const availability = LECTURE_ROOM_DAYS.map((day) => {
    const question = questionsByTitle.get(day.title);
    if (!question) return null;

    const answer = answers[question.id];
    const options = Array.isArray(answer)
      ? answer.map(String)
      : typeof answer === "string" && answer
        ? [answer]
        : [];
    return { label: day.label, options };
  });

  return availability.every(
    (item): item is LectureRoomAvailability => item !== null,
  )
    ? availability
    : null;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const responseData = error.response?.data;
  if (typeof responseData === "string") return responseData;
  if (
    responseData &&
    typeof responseData === "object" &&
    "message" in responseData &&
    typeof responseData.message === "string"
  ) {
    return responseData.message;
  }
  return fallback;
}

function getStatusBadge(status: string, useApprovalLabels: boolean) {
  switch (status) {
    case "PASSED":
      return (
        <Badge variant="outline" className={STATUS_TONES.positive}>
          {useApprovalLabels ? "승인" : "합격"}
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className={STATUS_TONES.negative}>
          {useApprovalLabels ? "미승인" : "불합격"}
        </Badge>
      );
    case "APPLIED":
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          신청
        </Badge>
      );
    case "IN_PROGRESS":
      return (
        <Badge variant="outline" className={STATUS_TONES.pending}>
          검토중
        </Badge>
      );
    case "WAITING":
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          대기
        </Badge>
      );
    case "HOLD":
      return (
        <Badge variant="outline" className={STATUS_TONES.pending}>
          보류
        </Badge>
      );
    case "CANCELED":
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          취소
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          {status}
        </Badge>
      );
  }
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<ApplicationResponse | null>(
    null,
  );
  const [formSnapshot, setFormSnapshot] = useState<FormSnapshot | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [isImportingSchedule, setIsImportingSchedule] = useState(false);

  const loadApplicationData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getApplicationById(applicationId);
      setApplication(data);
      console.log("Loaded application data:", data);

      // Parse formSnapshot
      try {
        const parsedSnapshot =
          typeof data.formSnapshot === "string"
            ? JSON.parse(data.formSnapshot)
            : data.formSnapshot;
        console.log("Parsed formSnapshot:", parsedSnapshot);
        setFormSnapshot(parsedSnapshot);
      } catch (e) {
        console.error("Failed to parse formSnapshot:", e);
        setFormSnapshot(null);
      }

      // Parse answers
      try {
        const parsedAnswers =
          typeof data.answers === "string"
            ? JSON.parse(data.answers)
            : data.answers;
        console.log("Parsed answers:", parsedAnswers);
        setAnswers(parsedAnswers);
      } catch (e) {
        console.error("Failed to parse answers:", e);
        setAnswers({});
      }
    } catch (error: unknown) {
      console.error("Failed to load application:", error);
      setError("지원서를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadApplicationData();
  }, [loadApplicationData]);

  async function handleStatusChange(id: string, newStatus: string) {
    if (!application) return;

    setIsUpdating(true);
    try {
      const updated = await reviewApplication(id, newStatus);
      setApplication(updated);
      if (newStatus === "PASSED" && application.recruitmentType === "NEW_MEMBER") {
        toast.success("합격 처리하고 회원가입 초대에 추가했습니다.");
      } else if (application.status === "PASSED" && application.recruitmentType === "NEW_MEMBER") {
        toast.success("상태를 변경하고 미가입 대상을 초대에서 제외했습니다.");
      } else {
        toast.success("상태를 변경했습니다.");
      }
    } catch (error: unknown) {
      console.error("Failed to update status:", error);
      toast.error(getApiErrorMessage(error, "상태 업데이트에 실패했습니다."));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleCopyEmail() {
    if (!application?.email) return;

    try {
      await navigator.clipboard.writeText(application.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (error: unknown) {
      console.error("Failed to copy email:", error);
    }
  }

  async function handleImportLectureRoomSchedule() {
    setIsImportingSchedule(true);
    try {
      const result = await importApplicationLectureRoomSchedule(applicationId);
      if (result.createdCount === 0) {
        toast.success("선택한 관리 시간이 이미 모두 반영되어 있습니다.");
      } else {
        const duplicateMessage = result.existingCount
          ? ` 기존 ${result.existingCount}개 블록은 유지했습니다.`
          : "";
        toast.success(
          `${result.userName}님의 관리 시간 ${result.createdCount}개를 반영했습니다.${duplicateMessage}`,
        );
      }
      setScheduleDialogOpen(false);
    } catch (error: unknown) {
      toast.error(
        getApiErrorMessage(error, "관리 시간을 반영하지 못했습니다."),
      );
    } finally {
      setIsImportingSchedule(false);
    }
  }

  function handleBackToRecruitment() {
    if (application?.recruitmentId) {
      router.push(`/manage/recruitments/${application.recruitmentId}`);
    } else {
      router.push("/manage/recruitments");
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        <Skeleton className="h-9 w-24" />

        <div className="space-y-4">
          {/* 기본 정보 Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Profile section */}
              <div className="flex items-center gap-4 mb-6">
                <Skeleton className="h-14 w-14 rounded-full shrink-0" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-px w-full mb-0" />
              {/* InfoRows */}
              <div className="divide-y">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-start gap-3 py-3">
                    <Skeleton className="h-4 w-4 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
          <p className="text-muted-foreground">
            {error || "지원서를 찾을 수 없습니다"}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => void loadApplicationData()} variant="outline">
              다시 시도
            </Button>
            <Button onClick={handleBackToRecruitment}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              목록으로
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const lectureRoomAvailability = getLectureRoomAvailability(
    formSnapshot,
    answers,
  );
  const availableLectureRoomSlotCount =
    lectureRoomAvailability?.reduce(
      (count, day) =>
        count + day.options.filter((option) => option.trim() !== "없음").length,
      0,
    ) ?? 0;
  const operationApplication =
    application.recruitmentType === "INTERNAL_OPERATION";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center">
        <Button onClick={handleBackToRecruitment} variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          돌아가기
        </Button>
      </div>

      <div className="space-y-4">
        {/* 기본 정보 Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                기본 정보
              </CardTitle>
              <ApplicationStatusDropdown
                applicationId={applicationId}
                currentStatus={application.status}
                onStatusChange={handleStatusChange}
                isUpdating={isUpdating}
                useApprovalLabels={operationApplication}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Profile-style header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-semibold text-primary">
                  {application.name?.charAt(0) || "?"}
                </span>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {application.name}의 {operationApplication ? "신청서" : "지원서"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(application.status, operationApplication)}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(application.createdAt)} 제출
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="divide-y">
              <InfoRow
                icon={<BookOpen className="h-4 w-4" />}
                label="학번"
                value={application.studentId}
              />
              {!operationApplication && (
                <>
                  <InfoRow
                    icon={<GraduationCap className="h-4 w-4" />}
                    label="전공"
                    value={
                      application.subMajor
                        ? `${application.major} / ${application.subMajor}`
                        : application.major
                    }
                  />
                  <InfoRow
                    icon={<Mail className="h-4 w-4" />}
                    label="이메일"
                    value={
                      <div className="flex items-center gap-2">
                        <span>{application.email}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={handleCopyEmail}
                        >
                          {copiedEmail ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    }
                  />
                  <InfoRow
                    icon={<Phone className="h-4 w-4" />}
                    label="전화번호"
                    value={application.phoneNumber}
                  />
                  {application.githubId && (
                    <InfoRow
                      icon={<Code2 className="h-4 w-4" />}
                      label="GitHub ID"
                      value={application.githubId}
                    />
                  )}
                </>
              )}
              <InfoRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="제출일시"
                value={formatDateTime(application.createdAt)}
              />
            </div>
          </CardContent>
        </Card>
        {/* Application Answers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>
              {operationApplication ? "신청서 답변" : "지원서 답변"}
            </CardTitle>
            {lectureRoomAvailability && (
              <Button
                size="sm"
                onClick={() => setScheduleDialogOpen(true)}
                disabled={availableLectureRoomSlotCount === 0}
              >
                시간표에 반영
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {formSnapshot?.questions && formSnapshot.questions.length > 0 ? (
              formSnapshot.questions.map((question, index) => {
                const answer = answers[question.id];
                const questionTitle = question.title || question.label || "";

                console.log(
                  `Question ${question.id}:`,
                  questionTitle,
                  "Answer:",
                  answer,
                );

                return (
                  <div key={question.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {index + 1}
                      </Badge>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-sm">
                          {question.required && <span className="mr-1">*</span>}
                          {questionTitle}
                        </p>
                      </div>
                    </div>
                    <div className="pl-8">
                      <div className="text-sm p-3 rounded-md bg-muted/50 whitespace-pre-wrap wrap-break-word">
                        {answer !== undefined &&
                        answer !== null &&
                        answer !== ""
                          ? String(answer)
                          : "-"}
                      </div>
                    </div>
                    {index < (formSnapshot.questions?.length ?? 0) - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">질문 정보를 불러올 수 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meta Info */}
        <Card>
          <CardHeader>
            <CardTitle>메타 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4">
              <div className="text-sm font-medium text-muted-foreground">
                {operationApplication ? "신청서 ID" : "지원서 ID"}
              </div>
              <div className="text-sm text-muted-foreground">
                {application.id}
              </div>

              <div className="text-sm font-medium text-muted-foreground">
                모집 공고 ID
              </div>
              <div className="text-sm text-muted-foreground">
                {application.recruitmentId}
              </div>

              <div className="text-sm font-medium text-muted-foreground">
                제출일시
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDateTime(application.createdAt)}
              </div>

              <div className="text-sm font-medium text-muted-foreground">
                최종 수정일시
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDateTime(application.modifiedAt)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>관리 시간을 시간표에 반영할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {application.name}님의 관리 가능 시간 {availableLectureRoomSlotCount}
              개를 모집 공고에 연결된 분기 시간표에 추가합니다. 이미 등록된
              시간은 중복으로 추가되지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImportingSchedule}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleImportLectureRoomSchedule();
              }}
              disabled={isImportingSchedule}
            >
              {isImportingSchedule && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              반영
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
