"use client";

import { useCallback, useEffect, useState } from "react";
import { parseSchema } from "@/lib/interfaces/form-builder";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileSearch,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOperationRecruitments } from "@/lib/api/recruitment";
import { getMyOperationApplications } from "@/lib/api/application";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ApplicationResponse } from "@/lib/interfaces/application";
import { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import { useMenuNotification } from "@/lib/contexts/MenuNotificationContext";
import { getMyApplicationBadge } from "@/lib/utils/operation-application-status";

type RecruitmentStatus = "신청 가능" | "예정" | "마감";

// 상태별 soft pill 스타일. "신청 가능"은 초록으로 강조하고, 앞의 점으로 상태 표시등 느낌을 준다.
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

export default function OperationRecruitmentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { newOperationRecruitmentIds } = useMenuNotification();
  const [recruitments, setRecruitments] = useState<RecruitmentResponse[]>([]);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadRecruitments = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [recruitmentData, applicationData] = await Promise.all([
        getOperationRecruitments(),
        getMyOperationApplications(),
      ]);
      setRecruitments(recruitmentData);
      setApplications(applicationData);
    } catch (loadError) {
      console.error("Failed to load operation recruitments:", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=%2Foperation-recruitments");
      return;
    }
    void loadRecruitments();
  }, [authLoading, isAuthenticated, loadRecruitments, router]);

  if (authLoading || !isAuthenticated) return null;

  // 사용자용 목록 노출 여부는 active로만 결정한다. (마감이어도 active=true면 계속 표시하고 상태만 "마감")
  // 정렬: 마감되지 않은 공고를 위에(기존 상대 순서 유지), 마감 공고는 맨 아래에 endAt 내림차순(최근 마감 우선).
  const visibleRecruitments = recruitments
    .filter((recruitment) => recruitment.active)
    .sort((a, b) => {
      const aClosed = getStatus(a) === "마감";
      const bClosed = getStatus(b) === "마감";
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      if (aClosed && bClosed) {
        return new Date(b.endAt).getTime() - new Date(a.endAt).getTime();
      }
      return 0; // 둘 다 비마감이면 기존 순서 유지(Array.sort는 안정 정렬)
    });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">학회 내부 신청/모집</h1>
          <p className="text-sm text-muted-foreground">
            학회실 관리자 모집과 멘토 모집 등 학회 내부 신청/모집을 확인할 수 있습니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/operation-recruitments/my")}
        >
          <FileSearch className="mr-2 h-4 w-4" />
          내 신청 내역
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            학회 내부 신청/모집을 불러오지 못했습니다.
          </p>
          <Button variant="outline" onClick={() => void loadRecruitments()}>
            다시 시도
          </Button>
        </div>
      ) : visibleRecruitments.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">
            등록된 학회 내부 신청/모집이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRecruitments.map((recruitment) => {
            const status = getStatus(recruitment);
            const submittedApplication = applications.find(
              (application) =>
                application.recruitmentId === recruitment.id &&
                application.status !== "CANCELED",
            );
            return (
              <Card key={recruitment.id}>
                <CardContent className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-base font-semibold">
                        {recruitment.title}
                      </h2>
                      {newOperationRecruitmentIds.includes(recruitment.id) && (
                        <Badge className="border-red-200 bg-red-50 text-[10px] font-semibold text-red-600 hover:bg-red-50">
                          신규
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[status].badge}
                      >
                        <span
                          className={`size-1.5 rounded-full ${STATUS_STYLES[status].dot}`}
                        />
                        {status}
                      </Badge>
                      {/* 공고 상태와 별개로, 내 신청 상태를 함께 표시한다. */}
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
                    {recruitment.description && (
                      <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                        {recruitment.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateTime(recruitment.startAt)} ~{" "}
                        {formatDateTime(recruitment.endAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" />
                        질문 {parseSchema(recruitment.questions).questions.length}개
                      </span>
                    </div>
                  </div>
                  {/* 목록에서는 바로 폼으로 가지 않고 항상 모집 상세로 이동해 내용을 먼저 확인시킨다.
                      신청 가능일 때만 "신청하기"(강조), 예정·마감은 "상세 내용 확인하기"로 안내한다. */}
                  {submittedApplication ? (
                    <Button
                      variant="outline"
                      className="group shrink-0 rounded-full"
                      onClick={() =>
                        router.push(`/operation-recruitments/${recruitment.id}`)
                      }
                    >
                      <FileText />
                      내 신청 보기
                    </Button>
                  ) : status === "신청 가능" ? (
                    <Button
                      className="group shrink-0 rounded-full shadow-sm"
                      onClick={() =>
                        router.push(`/operation-recruitments/${recruitment.id}`)
                      }
                    >
                      신청하기
                      <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="group shrink-0 rounded-full"
                      onClick={() =>
                        router.push(`/operation-recruitments/${recruitment.id}`)
                      }
                    >
                      상세 내용 확인하기
                      <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
