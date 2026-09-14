"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Pencil,
  CalendarDays,
  Calendar,
  ClipboardList,
  Info,
  UserRound,
  UsersRound,
  Copy,
  ExternalLink,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { getRecruitmentById, deleteRecruitment } from "@/lib/api/recruitment";
import { getApplicationsByRecruitmentId } from "@/lib/api/application";
import {} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import { ApplicationResponse } from "@/lib/interfaces/application";
import ApplicationsTable from "@/components/custom/application/application-table";
import { formatDate, formatDateTime } from "@/lib/utils/date-utils";
import { parseSchema } from "@/lib/interfaces/form-builder";

const MANAGER_SCHEDULE_QUESTION_TITLES = [
  "월요일관리가능한시간",
  "화요일관리가능한시간",
  "수요일관리가능한시간",
  "목요일관리가능한시간",
  "금요일관리가능한시간",
];

function isLectureRoomManagerRecruitment(
  recruitment: RecruitmentResponse,
): boolean {
  if (recruitment.type !== "INTERNAL_OPERATION") return false;
  const questionTitles = new Set(
    parseSchema(recruitment.form.schema).questions.map((question) =>
      question.title.replace(/\s+/g, ""),
    ),
  );
  return MANAGER_SCHEDULE_QUESTION_TITLES.every((title) =>
    questionTitles.has(title),
  );
}

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

type RecruitmentStatus = "모집중" | "모집 예정" | "모집 마감";

export default function RecruitmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const recruitmentId = params.id as string;

  const [recruitment, setRecruitment] = useState<RecruitmentResponse | null>(
    null,
  );
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadRecruitmentData();
  }, [recruitmentId]);

  async function loadRecruitmentData() {
    try {
      setIsLoading(true);
      setError(null);
      const [recruitmentData, applicationsData] = await Promise.all([
        getRecruitmentById(recruitmentId),
        getApplicationsByRecruitmentId(recruitmentId),
      ]);
      setRecruitment(recruitmentData);
      setApplications(applicationsData);
    } catch (error: any) {
      console.error("Failed to load recruitment:", error);
      setError("모집 공고를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    try {
      setIsDeleting(true);
      await deleteRecruitment(recruitmentId);
      router.push("/manage/recruitments");
    } catch {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  function getApplicationPath(): string {
    if (!recruitment) return "";
    return recruitment.type === "INTERNAL_OPERATION"
      ? `/operation-recruitments/${recruitment.id}`
      : `/apply?recruitmentId=${encodeURIComponent(recruitment.id)}`;
  }

  async function handleCopyApplicationLink() {
    if (!recruitment) return;
    const url = new URL(
      getApplicationPath(),
      window.location.origin,
    ).toString();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(
        recruitment.type === "INTERNAL_OPERATION"
          ? "신청 링크가 복사되었습니다."
          : "지원 링크가 복사되었습니다.",
      );
    } catch {
      toast.error("링크를 복사하지 못했습니다.");
    }
  }

  function getRecruitmentStatus(): RecruitmentStatus {
    if (!recruitment) return "모집 마감";

    const now = new Date();
    const start = new Date(recruitment.startAt);
    const end = new Date(recruitment.endAt);

    if (now < start) return "모집 예정";
    if (now > end) return "모집 마감";
    return "모집중";
  }

  function getStatusVariant(
    status: RecruitmentStatus,
  ): "default" | "secondary" | "outline" {
    if (status === "모집중") return "default";
    if (status === "모집 예정") return "secondary";
    return "outline";
  }

  // Calculate statistics with new status mapping
  const totalApplicants = applications.filter(
    (app) => app.status !== "CANCELED",
  ).length;
  const acceptedCount = applications.filter(
    (app) => app.status === "PASSED",
  ).length;
  const rejectedCount = applications.filter(
    (app) => app.status === "REJECTED",
  ).length;
  const waitingCount = applications.filter((app) =>
    ["APPLIED", "IN_PROGRESS", "WAITING", "HOLD"].includes(app.status),
  ).length;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        <Skeleton className="h-9 w-24" />
        <div className="space-y-4">
          {/* 기본 정보 Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {/* Title + Description */}
              <div className="mb-6 space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-full max-w-80" />
              </div>
              <Skeleton className="h-px w-full mb-0" />
              {/* Info Rows */}
              <div className="divide-y">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 py-3">
                    <Skeleton className="h-4 w-4 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !recruitment) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
          <p className="text-muted-foreground">
            {error || "모집 공고를 찾을 수 없습니다"}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => loadRecruitmentData()} variant="outline">
              다시 시도
            </Button>
            <Button onClick={() => router.push("/manage/recruitments")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              목록으로
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const status = getRecruitmentStatus();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <Button
          onClick={() => router.push("/manage/recruitments")}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <h1 className="text-xl font-bold tracking-tight">
          {recruitment.title}
        </h1>
        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
          <Badge variant={getStatusVariant(status)}>{status}</Badge>
          <Badge variant="outline">
            {recruitment.type === "INTERNAL_OPERATION"
              ? "학회 운영 관련 모집"
              : "신규 학회원 모집"}
          </Badge>
          <span>·</span>
          <span>{recruitment.quarter.name}</span>
          <span>·</span>
          <span>
            {formatDate(recruitment.startAt)} ~ {formatDate(recruitment.endAt)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {/* 기본 정보 Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {/* Title + Description */}
            <div className="mb-6">
              <p className="text-lg font-semibold">{recruitment.title}</p>
              {recruitment.description && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {recruitment.description}
                </p>
              )}
            </div>

            <Separator />

            <div className="divide-y">
              <InfoRow
                icon={<Info className="h-4 w-4" />}
                label="모집 유형"
                value={
                  recruitment.type === "INTERNAL_OPERATION"
                    ? "학회 운영 관련 모집"
                    : "신규 학회원 모집"
                }
              />
              <InfoRow
                icon={<Info className="h-4 w-4" />}
                label="상태"
                value={
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(status)}>{status}</Badge>

                    <Badge variant={recruitment.active ? "default" : "outline"}>
                      {recruitment.active ? "활성" : "비활성"}
                    </Badge>
                  </div>
                }
              />
              <InfoRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="분기"
                value={recruitment.quarter.name}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="기간"
                value={`${formatDate(recruitment.startAt)} ~ ${formatDate(recruitment.endAt)}`}
              />
              <InfoRow
                icon={<ClipboardList className="h-4 w-4" />}
                label={
                  recruitment.type === "INTERNAL_OPERATION"
                    ? "신청서 양식"
                    : "지원서 양식"
                }
                value={recruitment.form.title}
              />
              <InfoRow
                icon={<Link2 className="h-4 w-4" />}
                label={
                  recruitment.type === "INTERNAL_OPERATION"
                    ? "신청 링크"
                    : "지원 링크"
                }
                value={
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                      {getApplicationPath()}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label="링크 복사"
                      title="링크 복사"
                      onClick={() => void handleCopyApplicationLink()}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label="링크 열기"
                      title="링크 열기"
                      onClick={() =>
                        window.open(
                          getApplicationPath(),
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              {recruitment.type === "INTERNAL_OPERATION"
                ? "신청 현황"
                : "지원 현황"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UsersRound className="h-4 w-4" />
                  <span>
                    {recruitment.type === "INTERNAL_OPERATION"
                      ? "총 신청자"
                      : "총 지원자"}
                  </span>
                </div>
                <p className="text-3xl font-bold">{totalApplicants}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    {recruitment.type === "INTERNAL_OPERATION" ? "승인" : "합격"}
                  </span>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {acceptedCount}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  <span>
                    {recruitment.type === "INTERNAL_OPERATION"
                      ? "미승인"
                      : "불합격"}
                  </span>
                </div>
                <p className="text-3xl font-bold text-red-600">
                  {rejectedCount}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>대기</span>
                </div>
                <p className="text-3xl font-bold text-gray-600">
                  {waitingCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {recruitment.type === "INTERNAL_OPERATION"
                  ? "신청자 목록"
                  : "지원자 목록"}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                총 {applications.length}건
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ApplicationsTable
              applications={applications}
              enableBulkScheduleImport={isLectureRoomManagerRecruitment(
                recruitment,
              )}
              useApprovalLabels={recruitment.type === "INTERNAL_OPERATION"}
              onApplicationsDeleted={(deletedIds) => {
                const deletedSet = new Set(deletedIds);
                setApplications((prev) =>
                  prev.filter((application) => !deletedSet.has(application.id)),
                );
              }}
            />
          </CardContent>
        </Card>

        {/* Meta Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>메타 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4">
              <div className="text-sm font-medium text-muted-foreground">
                생성일
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDateTime(recruitment.createdAt)}
              </div>

              <div className="text-sm font-medium text-muted-foreground">
                수정일
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDateTime(recruitment.modifiedAt)}
              </div>

              <div className="text-sm font-medium text-muted-foreground">
                생성자
              </div>
              <div className="text-sm text-muted-foreground">
                {recruitment.createdBy?.name || "알 수 없음"}
              </div>

              <div className="text-sm font-medium text-muted-foreground">
                수정자
              </div>
              <div className="text-sm text-muted-foreground">
                {recruitment.modifiedBy?.name || "알 수 없음"}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/manage/recruitments/${recruitmentId}/edit`)
            }
          >
            <Pencil className="h-3 w-3" />
            <span className="text-xs">수정</span>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            <span className="text-xs">삭제</span>
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={recruitment.title}
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  );
}
