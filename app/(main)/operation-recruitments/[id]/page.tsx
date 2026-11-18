"use client";

import { useCallback, useEffect, useState } from "react";
import { parseSchema } from "@/lib/interfaces/form-builder";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOperationRecruitmentById } from "@/lib/api/recruitment";
import { getMyOperationApplications } from "@/lib/api/application";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useMenuNotification } from "@/lib/contexts/MenuNotificationContext";
import { ApplicationResponse } from "@/lib/interfaces/application";
import { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import { getMyApplicationBadge } from "@/lib/utils/operation-application-status";

type RecruitmentStatus = "신청 가능" | "예정" | "마감";

// 목록 탭과 동일한 상태별 soft pill 스타일.
const STATUS_STYLES: Record<RecruitmentStatus, { badge: string; dot: string }> = {
  "신청 가능": {
    badge: "border-green-200 bg-green-50 text-green-700 hover:bg-green-50",
    dot: "bg-green-500",
  },
  예정: {
    badge: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    dot: "bg-amber-500",
  },
  마감: {
    badge: "border-border bg-muted text-muted-foreground hover:bg-muted",
    dot: "bg-muted-foreground/50",
  },
};

// 모집 상태는 기간(startAt/endAt)만으로 결정한다. active는 상태 판정에 쓰지 않는다.
function getStatus(recruitment: RecruitmentResponse): RecruitmentStatus {
  const now = Date.now();
  if (now > new Date(recruitment.endAt).getTime()) {
    return "마감";
  }
  if (now < new Date(recruitment.startAt).getTime()) {
    return "예정";
  }
  return "신청 가능";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperationRecruitmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const recruitmentId = params.id;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { markItemViewed } = useMenuNotification();
  const [recruitment, setRecruitment] = useState<RecruitmentResponse | null>(
    null,
  );
  const [submittedApplication, setSubmittedApplication] =
    useState<ApplicationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [recruitmentData, applicationData] = await Promise.all([
        getOperationRecruitmentById(recruitmentId),
        getMyOperationApplications(),
      ]);
      setRecruitment(recruitmentData);
      setSubmittedApplication(
        applicationData.find(
          (application) =>
            application.recruitmentId === recruitmentId &&
            application.status !== "CANCELED",
        ) ?? null,
      );
    } catch (loadError) {
      console.error("Failed to load operation recruitment detail:", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [recruitmentId]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace(
        `/login?redirect=${encodeURIComponent(`/operation-recruitments/${recruitmentId}`)}`,
      );
      return;
    }
    void loadDetail();
  }, [authLoading, isAuthenticated, loadDetail, recruitmentId, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void markItemViewed("operation-recruitments", recruitmentId).catch(
      (error) => {
        console.error("Failed to mark recruitment card read:", error);
      },
    );
  }, [authLoading, isAuthenticated, recruitmentId, markItemViewed]);

  if (authLoading || !isAuthenticated) return null;

  const status = recruitment ? getStatus(recruitment) : null;
  // 실제 신청 가능 여부는 상태 표시와 별개로 active + 기간(신청 가능 상태)을 모두 만족해야 한다.
  const canApply = Boolean(recruitment?.active) && status === "신청 가능";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => router.push("/operation-recruitments")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        학회 내부 신청/모집
      </Button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !recruitment ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            신청/모집 정보를 불러오지 못했습니다.
          </p>
          <Button variant="outline" onClick={() => void loadDetail()}>
            다시 시도
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-bold tracking-tight">
                {recruitment.title}
              </h1>
              {status && (
                <Badge variant="outline" className={STATUS_STYLES[status].badge}>
                  <span
                    className={`size-1.5 rounded-full ${STATUS_STYLES[status].dot}`}
                  />
                  {status}
                </Badge>
              )}
              {/* 목록 카드와 동일하게, 공고 상태와 별개로 내 신청 상태를 표시한다. */}
              {submittedApplication &&
                (() => {
                  const myBadge = getMyApplicationBadge(
                    submittedApplication.status,
                  );
                  return (
                    <Badge
                      variant={myBadge.variant}
                      className={myBadge.className}
                    >
                      {myBadge.label}
                    </Badge>
                  );
                })()}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDateTime(recruitment.startAt)} ~{" "}
                {formatDateTime(recruitment.endAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" />
                질문 {parseSchema(recruitment.questions).questions.length}개
              </span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">안내</CardTitle>
            </CardHeader>
            <CardContent>
              {recruitment.description ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  {recruitment.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  등록된 안내가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            {submittedApplication ? (
              <Button
                variant="outline"
                className="group rounded-full"
                onClick={() =>
                  router.push(
                    `/operation-recruitments/my/${submittedApplication.id}?from=recruitment-detail&recruitmentId=${recruitmentId}`,
                  )
                }
              >
                <FileText />
                내 신청서 보기
              </Button>
            ) : canApply ? (
              <Button
                className="group rounded-full shadow-sm"
                onClick={() =>
                  router.push(
                    `/apply/form?operationRecruitmentId=${encodeURIComponent(recruitmentId)}`,
                  )
                }
              >
                신청서 작성
                <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            ) : status === "예정" ? (
              <Button variant="secondary" className="rounded-full" disabled>
                신청 시작 전입니다
              </Button>
            ) : status === "마감" ? (
              <Button variant="secondary" className="rounded-full" disabled>
                모집이 마감되었습니다
              </Button>
            ) : (
              // 기간상 신청 가능 상태이지만 active=false라 신청을 받지 않는 경우
              <Button variant="secondary" className="rounded-full" disabled>
                현재 신청을 받지 않습니다
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
