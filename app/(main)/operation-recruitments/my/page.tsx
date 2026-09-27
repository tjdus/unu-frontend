"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { applicationStatusTone } from "@/lib/constants/status-badge-tones";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyOperationApplications } from "@/lib/api/application";
import { ApplicationResponse } from "@/lib/interfaces/application";

// 학회 내부 신청/모집(INTERNAL_OPERATION) 전용 목록이므로 승인/미승인 문구를 쓴다.
const STATUS_LABELS: Record<string, string> = {
  APPLIED: "제출됨",
  IN_PROGRESS: "검토 중",
  PASSED: "승인",
  REJECTED: "미승인",
  CANCELED: "취소됨",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyOperationApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setApplications(await getMyOperationApplications());
    } catch (loadError) {
      console.error("Failed to load operation applications:", loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => router.push("/operation-recruitments")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          학회 내부 신청/모집
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">내 신청 내역</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            학회 내부 신청/모집에 제출한 신청서를 확인할 수 있습니다.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">
            신청 내역을 불러오지 못했습니다.
          </p>
          <Button variant="outline" onClick={() => void loadApplications()}>
            다시 시도
          </Button>
        </div>
      ) : applications.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">
            제출한 운영 관련 신청서가 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => (
            <Card
              key={application.id}
              className="cursor-pointer transition-colors hover:bg-muted/30"
              onClick={() =>
                router.push(`/operation-recruitments/my/${application.id}?from=my`)
              }
            >
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h2 className="break-words font-semibold">
                      {application.recruitmentTitle}
                    </h2>
                    <Badge
                      variant="outline"
                      className={applicationStatusTone(application.status)}
                    >
                      {STATUS_LABELS[application.status] || application.status}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(application.submittedAt || application.createdAt)}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0">
                  신청서 보기
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
