"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deepToast } from "@/components/custom/deep-toast";
import { DeepConfirmDialog } from "@/components/custom/deep-confirm-dialog";
import { useLeaveGuard } from "@/components/custom/use-leave-guard";
import {
  updateApplication,
  cancelApplicationByApplicant,
} from "@/lib/api/application";
import {
  ApplicationResponse,
  ApplicationAnswers,
} from "@/lib/interfaces/application";
import {
  FormSchema,
  parseSchema,
  validateRequiredAnswers,
} from "@/lib/interfaces/form-builder";
import { getPublicApiErrorMessage } from "@/lib/api/publicClient";
import { cn } from "@/lib/utils";
import {
  ApplyDivider,
  ApplyHero,
  ApplySkeleton,
  Chip,
  QuestionAnswer,
  QuestionInput,
  SectionHead,
  SectionNav,
  answersForSchema,
  applyStyles as styles,
  formatDot,
  formatTime,
} from "@/components/custom/apply/apply-ui";

const STATUS_LABELS: Record<string, string> = {
  APPLIED: "제출됨",
  CANCELED: "취소됨",
  PASSED: "합격",
  REJECTED: "불합격",
};

function parseAnswers(value: ApplicationResponse["answers"] | undefined): ApplicationAnswers {
  if (!value) return {};
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    console.error("Failed to parse answers:", error);
    return {};
  }
}

function clearStoredApplication() {
  sessionStorage.removeItem("current_application");
  sessionStorage.removeItem("current_application_token");
  sessionStorage.removeItem("current_application_pwd");
}

export default function ApplicationDetailPage() {
  const router = useRouter();

  const [accessToken, setAccessToken] = useState("");
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  // Questions as they were when the application was submitted (form snapshot).
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ApplicationAnswers>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const loadFromSession = useCallback(() => {
    try {
      sessionStorage.removeItem("current_application_pwd");
      const storedApp = sessionStorage.getItem("current_application");
      const storedToken = sessionStorage.getItem("current_application_token");

      if (!storedApp || !storedToken) {
        router.push("/apply/my");
        return;
      }

      const appData: ApplicationResponse = JSON.parse(storedApp);
      setApplication(appData);
      setAccessToken(storedToken);
      setSchema(appData.formSnapshot ? parseSchema(appData.formSnapshot) : null);
      setAnswers(parseAnswers(appData.answers));
      setIsLoading(false);
    } catch (loadError: unknown) {
      console.error("Failed to load from session:", loadError);
      router.push("/apply/my");
    }
  }, [router]);

  useEffect(() => {
    loadFromSession();
  }, [loadFromSession]);

  const savedAnswers = useMemo(() => parseAnswers(application?.answers), [application?.answers]);
  const isDirty = JSON.stringify(savedAnswers) !== JSON.stringify(answers);
  const canEdit = application?.status === "APPLIED";
  const { confirmLeave, leaveDialog } = useLeaveGuard(canEdit && isDirty && !isCanceling);

  const handleSave = async () => {
    if (!accessToken || !application || !schema) {
      setError("지원서 인증이 만료되었습니다. 다시 조회해주세요.");
      return;
    }

    const validationErrors = validateRequiredAnswers(schema, answers);
    setAnswerErrors(validationErrors);
    const firstError = Object.keys(validationErrors)[0];
    if (firstError) {
      deepToast.error("필수 질문에 모두 답변해주세요.");
      document.getElementById(`question-${firstError.slice(2)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const updatedApp = await updateApplication(
        application.id,
        {
          recruitmentId: application.recruitmentId,
          name: application.name,
          studentId: application.studentId,
          major: application.major,
          subMajor: application.subMajor || undefined,
          email: application.email,
          githubId: application.githubId || undefined,
          phoneNumber: application.phoneNumber,
          answers: answersForSchema(schema.questions, answers),
        },
        accessToken,
      );
      setApplication(updatedApp);
      setAnswers(parseAnswers(updatedApp.answers));
      sessionStorage.setItem("current_application", JSON.stringify(updatedApp));
      setLastSavedAt(new Date().toISOString());
      deepToast.success("지원서가 성공적으로 수정되었습니다.");
    } catch (saveError: unknown) {
      console.error("Failed to update application:", saveError);
      deepToast.error(getPublicApiErrorMessage(saveError, "지원서 수정에 실패했습니다. 다시 시도해주세요."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!accessToken || !application) {
      setError("지원서 인증이 만료되었습니다. 다시 조회해주세요.");
      return;
    }

    try {
      setIsCanceling(true);
      setError(null);
      await cancelApplicationByApplicant(application.id, accessToken);
      clearStoredApplication();
      deepToast.success("지원이 취소되었습니다.");
      router.push("/apply/my");
    } catch (cancelError: unknown) {
      console.error("Failed to cancel application:", cancelError);
      deepToast.error(getPublicApiErrorMessage(cancelError, "지원 취소에 실패했습니다. 다시 시도해주세요."));
      setIsCanceling(false);
      setCancelOpen(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setAnswerErrors((prev) => {
      if (!prev[`q_${questionId}`]) return prev;
      const next = { ...prev };
      delete next[`q_${questionId}`];
      return next;
    });
  };

  const handleBack = () => {
    confirmLeave(() => {
      clearStoredApplication();
      router.push("/apply/my");
    });
  };

  if (isLoading) return <ApplySkeleton />;

  const crumbs = [{ label: "내 지원서 조회", onClick: handleBack }, { label: "지원서 상세" }];

  if (!application) {
    return (
      <main className={styles.page}>
        <ApplyHero
          crumbs={crumbs}
          display="My apply"
          title="지원서를 불러올 수 없습니다"
          aside={
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={handleBack}>돌아가기</button>
            </div>
          }
        />
      </main>
    );
  }

  const statusLabel = STATUS_LABELS[application.status] ?? application.status;
  const questions = schema?.questions ?? [];
  const basicInfo: [string, string][] = [
    ["이름", application.name],
    ["학번", application.studentId],
    ["전공", application.major],
    ["부전공", application.subMajor || "—"],
    ["이메일", application.email],
    ["연락처", application.phoneNumber],
    ...(application.githubId ? ([["GitHub ID", application.githubId]] as [string, string][]) : []),
    ["제출일", formatDot(application.createdAt)],
  ];

  return (
    <main className={styles.page}>
      <ApplyHero
        crumbs={crumbs}
        display="My apply"
        title={application.recruitmentTitle}
        meta={
          <>
            <Chip active={application.status === "APPLIED" || application.status === "PASSED"}>{statusLabel}</Chip>
            <span>제출일 {formatDot(application.createdAt)}</span>
          </>
        }
        description={
          canEdit
            ? "모집 마감 전까지 답변을 수정하거나 지원을 취소할 수 있습니다.\n검토가 시작되면 수정할 수 없습니다."
            : "검토가 시작된 지원서는 수정할 수 없습니다.\n제출한 내용만 확인할 수 있습니다."
        }
      />

      <ApplyDivider />

      <div className={styles.body}>
        <SectionNav
          label="지원서 상세"
          items={[
            { href: "#basic-info", label: "01  기본 정보" },
            { href: "#answers", label: "02  지원서 답변" },
            ...(canEdit ? [{ href: "#save", label: "03  저장 · 취소" }] : []),
          ]}
        />

        <div className={cn(styles.content, styles.card)}>
          <section className={styles.section} id="basic-info" aria-labelledby="basic-info-title">
            <SectionHead tag="01 · Basic info" title="기본 정보" note="수정 불가" id="basic-info-title" />
            <dl className={styles.infoGrid}>
              {basicInfo.map(([label, value]) => (
                <div key={label} className={styles.info}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={styles.section} id="answers" aria-labelledby="answers-title">
            <SectionHead tag="02 · Answers" title="지원서 답변" id="answers-title" />
            {questions.length === 0 ? (
              <p className={styles.help}>답변이 없습니다</p>
            ) : (
              <div className={styles.questions}>
                {questions.map((question, index) =>
                  canEdit ? (
                    <QuestionInput
                      key={question.id}
                      question={question}
                      index={index}
                      value={answers[question.id]}
                      error={answerErrors[`q_${question.id}`]}
                      disabled={isSaving || isCanceling}
                      onChange={(value) => handleAnswerChange(question.id, value)}
                    />
                  ) : (
                    <QuestionAnswer key={question.id} question={question} index={index} value={answers[question.id]} />
                  ),
                )}
              </div>
            )}
          </section>

          {error && <p className={cn(styles.alert, styles.alertError)} role="alert">{error}</p>}

          {canEdit && (
            <section className={styles.submitRow} id="save" aria-label="저장 및 취소">
              <div>
                <span className={styles.tag} lang="en">03 · Save</span>
                <p className={styles.help}>
                  {isDirty
                    ? "저장하지 않은 변경 사항이 있습니다."
                    : lastSavedAt
                      ? `저장됨 · ${formatTime(lastSavedAt)}`
                      : "필수 질문에 모두 답변해야 저장할 수 있습니다."}
                </p>
              </div>
              <button
                type="button"
                className={cn(styles.buttonOutlined, styles.danger)}
                disabled={isCanceling || isSaving}
                onClick={() => setCancelOpen(true)}
              >
                {isCanceling ? "취소 중..." : "지원 취소"}
              </button>
              <DeepConfirmDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                title="지원을 취소할까요?"
                description={"취소한 지원서는 되돌릴 수 없습니다.\n다시 지원하려면 지원서를 새로 작성해야 합니다."}
                cancelLabel="돌아가기"
                confirmLabel="지원 취소"
                pendingLabel="취소 중..."
                destructive
                pending={isCanceling}
                onConfirm={() => void handleCancel()}
              />
              <button
                type="button"
                className={styles.button}
                onClick={handleSave}
                disabled={!isDirty || isSaving || isCanceling}
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </section>
          )}
        </div>
      </div>
      {leaveDialog}
    </main>
  );
}
