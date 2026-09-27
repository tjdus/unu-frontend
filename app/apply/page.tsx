"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText, Info, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  getActiveRecruitment,
  getPublicRecruitmentById,
} from "@/lib/api/recruitment";
import { getCurrentQuarter } from "@/lib/api/quarter";
import { ApiError } from "@/lib/api/publicClient";
import { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import { QuarterResponse } from "@/lib/interfaces/quarter";

function formatQuarterLabel(quarter: QuarterResponse): string {
  return `${String(quarter.year).slice(2)} ${quarter.season.toUpperCase()}`;
}

type RecruitmentStatus = "모집중" | "모집 예정" | "모집 마감";

function ApplyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recruitmentId = searchParams.get("recruitmentId");

  const [recruitment, setRecruitment] = useState<RecruitmentResponse | null>(
    null,
  );
  const [quarter, setQuarter] = useState<QuarterResponse | null>(null);
  const [currentQuarter, setCurrentQuarter] =
    useState<QuarterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActiveRecruitment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRecruitment(null);

    const [recruitmentResult, currentQuarterResult] = await Promise.allSettled([
      recruitmentId
        ? getPublicRecruitmentById(recruitmentId)
        : getActiveRecruitment(),
      getCurrentQuarter(),
    ]);

    if (currentQuarterResult.status === "fulfilled") {
      setCurrentQuarter(currentQuarterResult.value);
    }

    if (recruitmentResult.status === "fulfilled") {
      const recruitmentData = recruitmentResult.value;
      setRecruitment(recruitmentData);
      setQuarter(recruitmentData.quarter);
    } else {
      const reason = recruitmentResult.reason;
      const isNotFound = reason instanceof ApiError && reason.status === 404;
      if (isNotFound && recruitmentId) {
        setError("모집 정보를 찾을 수 없습니다.");
      } else if (!isNotFound) {
        console.error("Failed to load active recruitment:", reason);
        setError("모집 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    }

    setIsLoading(false);
  }, [recruitmentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadActiveRecruitment();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadActiveRecruitment]);

  function getRecruitmentStatus(): RecruitmentStatus {
    if (!recruitment) return "모집 마감";

    const now = new Date();
    const start = new Date(recruitment.startAt);
    const end = new Date(recruitment.endAt);

    if (now < start) return "모집 예정";
    if (now > end) return "모집 마감";
    return "모집중";
  }

  function getStatusBadge() {
    const status = getRecruitmentStatus();

    if (status === "모집중") {
      return <Badge className="bg-green-500 text-white">모집중</Badge>;
    }
    if (status === "모집 예정") {
      return <Badge variant="secondary">모집 예정</Badge>;
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        모집 마감
      </Badge>
    );
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleApply() {
    if (!recruitment) return;
    router.push(
      `/apply/form?recruitmentId=${encodeURIComponent(recruitment.id)}`,
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <div className="space-y-6">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-4">
              <p className="text-lg text-muted-foreground">{error}</p>
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => loadActiveRecruitment()}
                  variant="outline"
                >
                  다시 시도
                </Button>
                <Button onClick={() => router.push("/")}>
                  홈으로 돌아가기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!recruitment) {
    const quarterLabel = currentQuarter
      ? formatQuarterLabel(currentQuarter)
      : null;

    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          {quarterLabel ? `${quarterLabel} CNU` : "CNU"}
          <br />
          리크루팅 안내
        </h1>
        <p className="mt-6 text-muted-foreground">
          {quarterLabel
            ? `${quarterLabel} 분기 CNU 리크루팅이 곧 시작될 예정입니다.`
            : "다음 CNU 리크루팅이 곧 시작될 예정입니다."}
        </p>
        <Button
          variant="outline"
          className="mt-8 rounded-full px-8"
          onClick={() => router.push("/")}
        >
          리크루팅 공고
        </Button>
      </div>
    );
  }

  const status = getRecruitmentStatus();
  const canApply = status === "모집중" && recruitment.active;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto w-full max-w-5xl px-4 py-12">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          돌아가기
        </Button>

        <div className="space-y-8">
          {/* SECTION 1: Header */}
          <div className="space-y-4">
            <div className="flex min-w-0 items-start gap-3">
              <h1 className="min-w-0 flex-1 break-words text-3xl font-bold sm:text-4xl">
                {recruitment.title}
              </h1>
              {getStatusBadge()}
            </div>

            {/* Meta Info */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>
                  {formatDate(recruitment.startAt)} ~{" "}
                  {formatDate(recruitment.endAt)}
                </span>
              </div>
              {quarter && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {quarter.name}
                  </Badge>
                </div>
              )}
            </div>

            {!recruitment.active && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  이 모집은 현재 비활성 상태입니다
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* SECTION 2: Description */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">모집 안내</h2>
            {recruitment.description ? (
              <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {recruitment.description}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                상세 안내가 제공되지 않았습니다.
              </p>
            )}
          </div>

          {/* SECTION 3: Apply CTA */}
          <div className="bg-background rounded-lg border shadow-sm p-6 space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">지원하기</h2>
              <p className="text-sm text-muted-foreground">
                {canApply
                  ? "아래 버튼을 눌러 지원서를 작성할 수 있습니다."
                  : status === "모집 예정"
                    ? "모집 시작 후 신청할 수 있습니다."
                    : status === "모집 마감"
                      ? "모집이 마감되었습니다."
                      : "현재 신청할 수 없습니다"}
              </p>
            </div>

            {/* Key Info */}
            {canApply && (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2">
                  <span className="flex shrink-0 items-center gap-2" >
                    <Clock className="h-4 w-4" />
                    모집 마감
                  </span>
                  <span className="font-medium">
                    {formatDateTime(recruitment.endAt)}
                  </span>
                </div>
              </div>
            )}

            {/* Primary CTA */}
            <div className="space-y-3 pt-2">
              <Button
                size="lg"
                className="w-full text-base font-semibold"
                disabled={!canApply}
                onClick={handleApply}
              >
                지원서 작성하기
              </Button>

              {/* Secondary Action */}
              <Button
                size="lg"
                variant="outline"
                className="w-full border-foreground/40 text-base font-semibold"
                onClick={() => router.push("/apply/my")}
              >
                <FileText className="mr-2 h-4 w-4" />내 지원서 조회
              </Button>
            </div>

            {!canApply && !recruitment.active && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                이 모집은 관리자에 의해 비활성화되었습니다.
              </p>
            )}
          </div>

          {/* SECTION 4: Notice */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span>안내사항</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 pl-6">
              <li>지원서는 모집 기간 내에만 제출할 수 있습니다.</li>
              <li>
                제출 후 내용 확인 및 수정은 &quot;내 지원서 조회&quot; 메뉴를
                이용해주세요.
              </li>
              <li>문의사항이 있으시면 admin@cnu.team으로 연락해주세요.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={null}>
      <ApplyPageContent />
    </Suspense>
  );
}
