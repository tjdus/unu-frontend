"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getRecruitmentCompletionMessage } from "@/lib/api/recruitment";
import { hasApplicationSubmission } from "@/lib/utils/application-receipt";
import {
  ApplyDivider,
  ApplyHero,
  ApplySkeleton,
  Chip,
  SectionHead,
  applyStyles as styles,
} from "@/components/custom/apply/apply-ui";

const CHECK_PATH = ["홈 화면 지원 안내", "지원하러 가기", "내 지원서 조회"];
const subscribeToNothing = () => () => undefined;

function ApplicationCompletion({ recruitmentId }: { recruitmentId: string | null }) {
  const router = useRouter();
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const hasReceipt = useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(recruitmentId && hasApplicationSubmission(recruitmentId)),
    () => null,
  );

  useEffect(() => {
    if (hasReceipt === false) {
      router.replace("/apply");
      return;
    }
    if (!hasReceipt || !recruitmentId) return;

    let cancelled = false;
    getRecruitmentCompletionMessage(recruitmentId)
      .then(({ completionMessage: message }) => {
        if (!cancelled) setCompletionMessage(message?.trim() || null);
      })
      .catch(() => {
        // The submission is already complete, so an optional notice failure is non-blocking.
      });
    return () => { cancelled = true; };
  }, [hasReceipt, recruitmentId, router]);

  if (!hasReceipt) return <ApplySkeleton />;

  const applyHref = "/apply";

  return (
    <main className={styles.page}>
      <ApplyHero
        crumbs={[{ label: "지원 안내", href: applyHref }, { label: "제출 완료" }]}
        display="Thank you"
        title={"지원서 제출이\n완료되었습니다"}
        meta={<Chip active>제출됨</Chip>}
        description={"제출하신 지원서는 정상적으로 접수되었습니다.\n결과는 입력하신 이메일로 안내드릴 예정입니다."}
      />

      <ApplyDivider />

      <div className={`${styles.body} ${styles.bodyCentered}`}>
        <div className={styles.content}>
          {completionMessage && (
            <section className={styles.section} aria-labelledby="complete-next">
              <SectionHead title="안내" id="complete-next" />
              <p className={styles.lead}>{completionMessage}</p>
            </section>
          )}

          <section className={`${styles.panel} ${styles.panelOutlined}`} aria-labelledby="complete-path">
            <div className={styles.panelHead}>
              <div>
                <span className={styles.tag} lang="en">Check your application</span>
                <h2 id="complete-path">지원서 확인 경로</h2>
              </div>
            </div>
            <p className={styles.path}>
              {CHECK_PATH.map((step, index) => (
                <span key={step} className="contents">
                  {index > 0 && <ArrowRight className="size-4" aria-hidden="true" />}
                  <span aria-current={index === CHECK_PATH.length - 1 ? "step" : undefined}>{step}</span>
                </span>
              ))}
            </p>
            <p className={styles.help}>
              위 경로에서 제출 내용을 확인하고, 마감일 전까지 지원서를 수정하거나 취소할 수 있습니다.
            </p>
          </section>

          <div className={styles.actions}>
            <Link href={applyHref} className={styles.buttonOutlined}>지원 페이지로 돌아가기</Link>
            <Link href="/apply/my" className={styles.button}>내 지원서 조회</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function ApplicationCompleteRoute() {
  const recruitmentId = useSearchParams().get("recruitmentId");
  return <ApplicationCompletion key={recruitmentId} recruitmentId={recruitmentId} />;
}

export default function ApplicationCompletePage() {
  return (
    <Suspense fallback={<ApplySkeleton />}>
      <ApplicationCompleteRoute />
    </Suspense>
  );
}
