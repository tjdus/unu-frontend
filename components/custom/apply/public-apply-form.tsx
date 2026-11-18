"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deepToast } from "@/components/custom/deep-toast";
import {
  getActiveRecruitment,
  getPublicRecruitmentById,
} from "@/lib/api/recruitment";
import { createApplication } from "@/lib/api/application";
import { getPublicApiErrorMessage } from "@/lib/api/publicClient";
import { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import { ApplicationAnswers } from "@/lib/interfaces/application";
import {
  FormSchema,
  parseSchema,
  validateRequiredAnswers,
} from "@/lib/interfaces/form-builder";
import { cn } from "@/lib/utils";
import {
  ApplyDivider,
  ApplyHero,
  ApplySkeleton,
  Field,
  QuestionInput,
  SectionHead,
  SectionNav,
  StatusChip,
  answersForSchema,
  applyStyles as styles,
  canApplyTo,
  formatDeadline,
  getRecruitmentStatus,
} from "./apply-ui";

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

type BasicInfo = {
  name: string;
  studentId: string;
  major: string;
  subMajor: string;
  email: string;
  phoneNumber: string;
  githubId: string;
  password: string;
  passwordConfirm: string;
};

const EMPTY_INFO: BasicInfo = {
  name: "",
  studentId: "",
  major: "",
  subMajor: "",
  email: "",
  phoneNumber: "",
  githubId: "",
  password: "",
  passwordConfirm: "",
};

/** Public new-member application (/apply/form?recruitmentId=…). Questions come from the
 *  recruitment's form, which is created from a form template. */
export function PublicApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recruitmentId = searchParams.get("recruitmentId");
  const backHref = recruitmentId
    ? `/apply?recruitmentId=${encodeURIComponent(recruitmentId)}`
    : "/apply";

  const [recruitment, setRecruitment] = useState<RecruitmentResponse | null>(null);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [info, setInfo] = useState<BasicInfo>(EMPTY_INFO);
  const [answers, setAnswers] = useState<ApplicationAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = recruitmentId
        ? await getPublicRecruitmentById(recruitmentId)
        : await getActiveRecruitment();
      setRecruitment(data);
      setSchema(parseSchema(data.questions));
    } catch (loadError: unknown) {
      console.error("Failed to load form:", loadError);
      setError("지원서를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [recruitmentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const update = (key: keyof BasicInfo, value: string) => {
    setInfo((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  };

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    clearError(`q_${questionId}`);
  };

  function validateForm(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!info.name.trim()) next.name = "이름을 입력해주세요.";
    if (!/^\d{8}$/.test(info.studentId)) next.studentId = "학번은 숫자 8자리로 입력해주세요.";
    if (!info.major.trim()) next.major = "전공을 입력해주세요.";
    if (!info.email.trim()) next.email = "이메일을 입력해주세요.";
    if (!/^\d{3}-\d{4}-\d{4}$/.test(info.phoneNumber))
      next.phoneNumber = "연락처를 000-0000-0000 형식으로 입력해주세요.";
    if (!info.password.trim()) next.password = "비밀번호를 입력해주세요.";
    else if (info.password.length < 6) next.password = "비밀번호는 6자 이상이어야 합니다.";
    if (!info.passwordConfirm.trim()) next.passwordConfirm = "비밀번호 확인을 입력해주세요.";
    else if (info.password !== info.passwordConfirm) next.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (schema) Object.assign(next, validateRequiredAnswers(schema, answers));
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!recruitment) return;

    if (!canApplyTo(recruitment)) {
      deepToast.error("모집 기간에만 제출할 수 있습니다.");
      return;
    }

    const nextErrors = validateForm();
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      deepToast.error("입력 항목을 다시 확인해주세요.");
      const target = firstError.startsWith("q_")
        ? document.getElementById(`question-${firstError.slice(2)}`)
        : document.querySelector<HTMLElement>(`[name="${firstError}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
      setIsSubmitting(true);
      await createApplication({
        name: info.name,
        studentId: info.studentId,
        major: info.major,
        subMajor: info.subMajor || undefined,
        email: info.email,
        githubId: info.githubId || undefined,
        phoneNumber: info.phoneNumber,
        answers: answersForSchema(schema?.questions ?? [], answers),
        recruitmentId: recruitment.id,
        password: info.password,
      });
      router.push(`/apply/complete?recruitmentId=${encodeURIComponent(recruitment.id)}`);
    } catch (submitError: unknown) {
      console.error("Failed to submit application:", submitError);
      deepToast.error(getPublicApiErrorMessage(submitError, "지원서 제출에 실패했습니다. 다시 시도해주세요."));
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <ApplySkeleton />;

  if (error || !recruitment || !schema) {
    return (
      <main className={styles.page}>
        <ApplyHero
          crumbs={[{ label: "지원 안내", href: backHref }, { label: "지원서 작성" }]}
          display="Apply"
          title="지원서를 불러올 수 없습니다"
          description={error ?? "잠시 후 다시 시도해 주세요."}
          aside={
            <div className={styles.actions}>
              <button type="button" className={styles.buttonOutlined} onClick={() => void loadData()}>
                다시 시도
              </button>
              <button type="button" className={styles.button} onClick={() => router.push(backHref)}>
                돌아가기
              </button>
            </div>
          }
        />
      </main>
    );
  }

  const status = getRecruitmentStatus(recruitment);
  const open = canApplyTo(recruitment);
  const disabled = !open || isSubmitting;
  const inputProps = (key: keyof BasicInfo) => ({
    name: key,
    value: info[key],
    error: errors[key],
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(key, event.target.value),
  });

  return (
    <main className={styles.page}>
      <ApplyHero
        crumbs={[{ label: "지원 안내", href: backHref }, { label: "지원서 작성" }]}
        display="Apply"
        title={recruitment.title}
        meta={
          <>
            <StatusChip status={status} />
            <span>마감 {formatDeadline(recruitment.endAt)}</span>
          </>
        }
        description={
          "질문에 답변을 작성하고 제출을 부탁드립니다. * 표시는 필수 항목입니다.\n작성해 주신 지원서는 감사한 마음으로 신중히 검토하겠습니다."
        }
      />

      <ApplyDivider />

      <form className={styles.body} onSubmit={handleSubmit} autoComplete="off" noValidate>
        <SectionNav
          label="지원서"
          items={[
            { href: "#basic-info", label: "01  기본 정보" },
            { href: "#questions", label: "02  지원서 질문" },
            { href: "#submit", label: "03  제출" },
          ]}
        />

        <div className={cn(styles.content, styles.card)}>
          {!open && (
            <p className={styles.alert} role="status">모집 기간에만 제출할 수 있습니다.</p>
          )}

          <section className={styles.section} id="basic-info" aria-labelledby="basic-info-title">
            <SectionHead tag="01 · Basic info" title="기본 정보" note="* 필수" id="basic-info-title" />
            <div className={styles.fieldGrid}>
              <Field label="이름" required autoComplete="off" {...inputProps("name")} />
              <Field
                label="학번"
                required
                inputMode="numeric"
                maxLength={8}
                {...inputProps("studentId")}
                onChange={(event) => update("studentId", event.target.value.replace(/\D/g, "").slice(0, 8))}
              />
              <Field label="전공" required {...inputProps("major")} />
              <Field label="부전공" placeholder="선택사항" {...inputProps("subMajor")} />
              <Field label="이메일" required type="email" placeholder="example@email.com" {...inputProps("email")} />
              <Field
                label="연락처"
                required
                type="tel"
                inputMode="tel"
                maxLength={13}
                placeholder="010-0000-0000"
                {...inputProps("phoneNumber")}
                onChange={(event) => update("phoneNumber", formatPhoneNumber(event.target.value))}
              />
              <Field label="GitHub ID" placeholder="선택사항" {...inputProps("githubId")} />
            </div>
            <p className={styles.help}>지원서 조회 · 수정에 사용할 비밀번호를 정해 주세요.</p>
            <div className={styles.fieldGrid}>
              <Field label="비밀번호" required secret autoComplete="new-password" support="6자 이상" {...inputProps("password")} />
              <Field
                label="비밀번호 확인"
                required
                secret
                autoComplete="new-password"
                support="한 번 더 입력해 주세요"
                {...inputProps("passwordConfirm")}
              />
            </div>
          </section>

          <section className={styles.section} id="questions" aria-labelledby="questions-title">
            <SectionHead tag="02 · Questions" title="지원서 질문" id="questions-title" />
            {schema.questions.length === 0 ? (
              <p className={styles.help}>이 모집에는 추가 질문이 없습니다.</p>
            ) : (
              <div className={styles.questions}>
                {schema.questions.map((question, index) => (
                  <QuestionInput
                    key={question.id}
                    question={question}
                    index={index}
                    value={answers[question.id]}
                    error={errors[`q_${question.id}`]}
                    disabled={disabled}
                    onChange={(value) => handleAnswerChange(question.id, value)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.submitRow} id="submit" aria-label="제출">
            <div>
              <span className={styles.tag} lang="en">03 · Submit</span>
              <p className={styles.help}>제출 후에도 모집 마감 전까지 “내 지원서 조회”에서 수정할 수 있습니다.</p>
            </div>
            <button
              type="button"
              className={styles.buttonOutlined}
              onClick={() => router.push(backHref)}
              disabled={isSubmitting}
            >
              돌아가기
            </button>
            <button type="submit" className={styles.button} disabled={disabled}>
              {isSubmitting ? "제출 중..." : "제출하기"}
            </button>
          </section>
        </div>
      </form>
    </main>
  );
}
