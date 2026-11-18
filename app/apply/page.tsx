"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getActiveRecruitment,
  getPublicRecruitmentById,
} from "@/lib/api/recruitment";
import { getCurrentQuarter } from "@/lib/api/quarter";
import { ApiError } from "@/lib/api/publicClient";
import { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import {
  ApplyDivider,
  ApplyHero,
  ApplySkeleton,
  Chip,
  SectionHead,
  StatusChip,
  applyStyles as styles,
  canApplyTo,
  formatDeadline,
  formatDot,
  formatQuarterLabel,
  formatTime,
  getRecruitmentStatus,
} from "@/components/custom/apply/apply-ui";
import { cn } from "@/lib/utils";

const HOME_CRUMBS = [{ label: "Home", href: "/" }, { label: "지원" }];

function ApplyPageContent() {
  const searchParams = useSearchParams();
  const recruitmentId = searchParams.get("recruitmentId");

  const [recruitment, setRecruitment] = useState<RecruitmentResponse | null>(null);
  const [currentQuarter, setCurrentQuarter] = useState<QuarterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActiveRecruitment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRecruitment(null);

    const [recruitmentResult, currentQuarterResult] = await Promise.allSettled([
      recruitmentId ? getPublicRecruitmentById(recruitmentId) : getActiveRecruitment(),
      getCurrentQuarter(),
    ]);

    if (currentQuarterResult.status === "fulfilled") {
      setCurrentQuarter(currentQuarterResult.value);
    }

    if (recruitmentResult.status === "fulfilled") {
      setRecruitment(recruitmentResult.value);
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

  if (isLoading) return <ApplySkeleton />;

  if (error) {
    return (
      <main className={styles.page}>
        <ApplyHero
          crumbs={HOME_CRUMBS}
          display="Recruit"
          title="모집 정보를 확인할 수 없습니다"
          description={error}
          aside={
            <div className={styles.actions}>
              <button type="button" className={styles.buttonOutlined} onClick={() => void loadActiveRecruitment()}>
                다시 시도
              </button>
              <Link href="/" className={styles.button}>홈으로 돌아가기</Link>
            </div>
          }
        />
      </main>
    );
  }

  // No recruitment yet: the "SOON" state.
  if (!recruitment) {
    const quarterLabel = currentQuarter ? formatQuarterLabel(currentQuarter) : null;
    return (
      <main className={styles.page}>
        <ApplyHero
          crumbs={HOME_CRUMBS}
          display="Soon"
          title={`${quarterLabel ? `${quarterLabel} ` : ""}CNU\n리크루팅 안내`}
          meta={<Chip>모집 예정</Chip>}
          description={
            quarterLabel
              ? `${quarterLabel} 분기 CNU 리크루팅이 곧 시작될 예정입니다.\n모집이 열리면 이 페이지에서 바로 지원할 수 있습니다.`
              : "다음 CNU 리크루팅이 곧 시작될 예정입니다.\n모집이 열리면 이 페이지에서 바로 지원할 수 있습니다."
          }
          aside={
            <div className={styles.actions}>
              <Link href="/" className={styles.buttonOutlined}>리크루팅 공고</Link>
            </div>
          }
        />
      </main>
    );
  }

  const status = getRecruitmentStatus(recruitment);
  const canApply = canApplyTo(recruitment);
  const formHref = `/apply/form?recruitmentId=${encodeURIComponent(recruitment.id)}`;
  const quarterLabel = recruitment.quarter ? formatQuarterLabel(recruitment.quarter) : null;

  return (
    <main className={styles.page}>
      <ApplyHero
        crumbs={HOME_CRUMBS}
        display="Recruit"
        title={recruitment.title}
        meta={
          <>
            <StatusChip status={status} />
            {quarterLabel && <Chip>{quarterLabel}</Chip>}
            <span>{formatDot(recruitment.startAt)} — {formatDot(recruitment.endAt)}</span>
          </>
        }
        description={
          !recruitment.active
            ? "이 모집은 현재 비활성 상태입니다."
            : status === "모집 예정"
              ? "모집이 시작되면 지원서를 작성할 수 있습니다.\n아래 모집 안내를 먼저 확인해 주세요."
              : status === "모집 마감"
                ? "모집이 마감되었습니다.\n제출한 지원서는 “내 지원서 조회”에서 확인할 수 있습니다."
                : "아래 모집 안내를 확인하고 지원서를 작성해 주세요.\n제출한 지원서는 모집 마감 전까지 수정하거나 취소할 수 있습니다."
        }
      />

      <ApplyDivider />

      <div className={cn(styles.body, styles.bodyCentered)}>
        <div className={styles.content}>
          <section className={styles.section} aria-labelledby="apply-guide">
            <SectionHead tag="About this recruitment" title="모집 안내" id="apply-guide" />
            <dl className={styles.period}>
              <dt>모집 기간</dt>
              <dd>
                <time dateTime={recruitment.startAt}>{formatDot(recruitment.startAt)}</time>
                <span aria-hidden="true">—</span>
                <time dateTime={recruitment.endAt}>{formatDot(recruitment.endAt)} {formatTime(recruitment.endAt)}</time>
              </dd>
            </dl>
            {recruitment.description?.trim() ? (
              <p className={styles.lead}>{recruitment.description}</p>
            ) : (
              <p className={styles.help}>상세 안내가 제공되지 않았습니다.</p>
            )}
          </section>

          <section className={cn(styles.panel, styles.panelOutlined)} aria-labelledby="apply-cta">
            <div className={styles.panelHead}>
              <div>
                <span className={cn(styles.tag)} lang="en">Apply</span>
                <h2 id="apply-cta">지원하기</h2>
                <p>
                  {canApply
                    ? "아래 버튼을 눌러 지원서를 작성할 수 있습니다."
                    : !recruitment.active
                      ? "이 모집은 관리자에 의해 비활성화되었습니다."
                      : status === "모집 예정"
                        ? "모집 시작 후 신청할 수 있습니다."
                        : "모집이 마감되었습니다."}
                </p>
              </div>
              <div className={styles.deadline}>
                <span>{status === "모집 예정" ? "모집 시작" : "모집 마감"}</span>
                <strong>{formatDeadline(status === "모집 예정" ? recruitment.startAt : recruitment.endAt)}</strong>
              </div>
            </div>
            <div className={styles.actions}>
              {canApply ? (
                <Link href={formHref} className={styles.button}>지원서 작성하기</Link>
              ) : (
                <button type="button" className={styles.button} disabled>지원서 작성하기</button>
              )}
              <Link href="/apply/my" className={styles.buttonOutlined}>내 지원서 조회</Link>
            </div>
          </section>

          <section className={styles.notice} aria-labelledby="apply-notice">
            <h2 id="apply-notice">안내사항</h2>
            <ul>
              <li>지원서는 모집 기간 내에만 제출할 수 있습니다.</li>
              <li>제출 후 내용 확인 및 수정은 “내 지원서 조회”에서 할 수 있습니다.</li>
              <li>
                <span>문의사항은 <a href="mailto:admin@cnu.team">admin@cnu.team</a>으로 보내 주세요.</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<ApplySkeleton />}>
      <ApplyPageContent />
    </Suspense>
  );
}
