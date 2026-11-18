"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import MemberAppLayout from "@/components/layout/MemberAppLayout";
import { ApplySkeleton } from "@/components/custom/apply/apply-ui";
import { PublicApplyForm } from "@/components/custom/apply/public-apply-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createOperationApplication } from "@/lib/api/application";
import { getMe } from "@/lib/api/auth";
import { getPublicApiErrorMessage } from "@/lib/api/publicClient";
import { getOperationRecruitmentById } from "@/lib/api/recruitment";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useMenuNotification } from "@/lib/contexts/MenuNotificationContext";
import type { ApplicationAnswers } from "@/lib/interfaces/application";
import { parseSchema, validateRequiredAnswers, type Question } from "@/lib/interfaces/form-builder";

const deadlineFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

type FormDataState = {
  recruitment: Awaited<ReturnType<typeof getOperationRecruitmentById>>;
  profile: Awaited<ReturnType<typeof getMe>>;
};

function recruitmentStatus(active: boolean, start: number, end: number, now: number) {
  if (!active || !Number.isFinite(start) || !Number.isFinite(end) || now > end) return "모집 마감";
  return now < start ? "모집 예정" : "모집 중";
}

function OperationQuestion({ question, index, answer, error, disabled, onChange }: {
  question: Question;
  index: number;
  answer: ApplicationAnswers[string] | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const questionId = `operation-question-${question.id}`;
  const text = typeof answer === "string" ? answer : "";
  const selected = Array.isArray(answer) ? answer : [];
  const textInputProps = {
    id: questionId,
    value: text,
    placeholder: "답변을 입력하세요",
    disabled,
    "aria-invalid": Boolean(error),
    "aria-required": question.required,
    "aria-describedby": error ? `${questionId}-error` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  const legend = <>{index + 1}. {question.title}{question.required && <span className="ml-1 text-destructive">*</span>}</>;
  const legendClass = "mb-3 whitespace-pre-wrap wrap-anywhere text-base font-semibold";

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className={legendClass}>
        {question.type === "SHORT_TEXT" || question.type === "LONG_TEXT" ? (
          <label htmlFor={questionId}>{legend}</label>
        ) : legend}
      </legend>
      {question.type === "SHORT_TEXT" && <Input {...textInputProps} />}
      {question.type === "LONG_TEXT" && <Textarea {...textInputProps} rows={5} className="min-h-28" />}
      {question.type === "SINGLE_CHOICE" && (
        <RadioGroup value={text} onValueChange={onChange} disabled={disabled} aria-invalid={Boolean(error)} className="gap-3">
          {question.options?.map((option, optionIndex) => (
            <label key={optionIndex} className="flex items-start gap-2.5 text-sm">
              <RadioGroupItem value={option} className="mt-0.5 shrink-0" />
              <span className="wrap-anywhere">{option}</span>
            </label>
          ))}
        </RadioGroup>
      )}
      {question.type === "MULTIPLE_CHOICE" && (
        <div className="grid gap-3">
          {question.options?.map((option, optionIndex) => (
            <label key={optionIndex} className="flex items-start gap-2.5 text-sm">
              <Checkbox
                className="mt-0.5 shrink-0"
                checked={selected.includes(option)}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(checked === true
                  ? option.trim() === "없음" ? [option] : [...selected.filter((value) => value.trim() !== "없음"), option]
                  : selected.filter((value) => value !== option))}
              />
              <span className="wrap-anywhere">{option}</span>
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert" id={`${questionId}-error`} className="mt-2 text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}

function OperationApplyForm({ id }: { id: string }) {
  const router = useRouter();
  const { userId, isLoading: authLoading } = useAuth();
  const { markItemViewed } = useMenuNotification();
  const [data, setData] = useState<FormDataState | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<ApplicationAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now);
  const listHref = "/operation-recruitments";
  const backHref = `${listHref}/${encodeURIComponent(id)}`;

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      const target = `/apply/form?operationRecruitmentId=${encodeURIComponent(id)}`;
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }

    let cancelled = false;
    void Promise.all([getOperationRecruitmentById(id), getMe()])
      .then(([recruitment, profile]) => {
        if (!cancelled) {
          setNow(Date.now());
          setData({ recruitment, profile });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [attempt, authLoading, id, router, userId]);

  const recruitment = data?.recruitment;
  useEffect(() => {
    if (!recruitment) return;
    void markItemViewed("operation-recruitments", recruitment.id).catch(() => undefined);
  }, [markItemViewed, recruitment]);

  const schema = recruitment ? parseSchema(recruitment.questions) : null;
  const start = recruitment ? new Date(recruitment.startAt).getTime() : NaN;
  const end = recruitment ? new Date(recruitment.endAt).getTime() : NaN;
  const active = Boolean(recruitment?.active);
  const status = recruitmentStatus(active, start, end, now);
  const canSubmit = status === "모집 중";

  useEffect(() => {
    const boundary = status === "모집 예정" ? start : status === "모집 중" ? end + 1 : null;
    if (boundary === null) return;
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, boundary - Date.now()), 2_147_483_647),
    );
    return () => window.clearTimeout(timeout);
  }, [start, end, now, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recruitment || !schema || submitting) return;
    if (recruitmentStatus(active, start, end, new Date().getTime()) !== "모집 중") {
      toast.error("모집 기간에만 제출할 수 있습니다.");
      return;
    }
    const validation = validateRequiredAnswers(schema, answers);
    setErrors(validation);
    if (Object.keys(validation).length) {
      toast.error("입력 항목을 다시 확인해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await createOperationApplication(recruitment.id, { answers });
      router.push(`/operation-recruitments/complete?recruitmentId=${encodeURIComponent(recruitment.id)}`);
    } catch (error) {
      toast.error(getPublicApiErrorMessage(error, "신청서 제출에 실패했습니다. 다시 시도해주세요."));
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Button asChild variant="ghost" className="-ml-3 mb-4">
        <Link href={listHref}><ArrowLeft size={16} />학회 내부 신청/모집</Link>
      </Button>
      {authLoading || (!data && !failed) ? (
        <div className="space-y-5" aria-busy="true" aria-label="신청서 불러오는 중">
          <Skeleton className="h-10 max-w-80" />
          <Skeleton className="h-48 max-w-[800px]" />
        </div>
      ) : !data || !recruitment || !schema ? (
        <div role="alert" className="space-y-4 border-t pt-6">
          <p className="text-muted-foreground">신청서를 불러오지 못했습니다.</p>
          <Button variant="outline" onClick={() => { setFailed(false); setData(null); setAttempt((value) => value + 1); }}>다시 시도</Button>
        </div>
      ) : (
        <>
          <header className="space-y-3 pb-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="min-w-0 wrap-anywhere text-[28px] font-semibold sm:text-4xl">{recruitment.title}</h1>
              <span className="rounded-full bg-[var(--m3-secondary-container)] px-2.5 py-1 text-xs font-semibold text-[var(--m3-deep)]">{status}</span>
            </div>
            {Number.isFinite(end) && <p className="text-sm text-muted-foreground">신청 마감 · {deadlineFormat.format(end)}</p>}
          </header>
          <form onSubmit={handleSubmit} autoComplete="off" className="max-w-[800px] space-y-8 pt-6">
            <section aria-label="신청자 정보" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-4 py-3 text-sm">
              <span className="text-muted-foreground">신청자</span>
              <strong className="wrap-anywhere font-medium">{data.profile.name}</strong>
              <span className="text-muted-foreground">{data.profile.studentId}</span>
            </section>
            {!canSubmit && <p role="status" className="text-sm text-muted-foreground">모집 기간에만 신청할 수 있습니다.</p>}
            {schema.questions.map((question, index) => (
              <OperationQuestion
                key={question.id}
                question={question}
                index={index}
                answer={answers[question.id]}
                error={errors[`q_${question.id}`]}
                disabled={!canSubmit || submitting}
                onChange={(value) => {
                  setAnswers((current) => ({ ...current, [question.id]: value }));
                  const key = `q_${question.id}`;
                  setErrors((current) => current[key] ? { ...current, [key]: "" } : current);
                }}
              />
            ))}
            <div className="flex flex-wrap items-center gap-3 border-t pt-6">
              <Button type="submit" disabled={!canSubmit || submitting}>{submitting ? "제출 중..." : "신청하기"}</Button>
              {submitting ? <Button type="button" variant="outline" disabled>취소</Button> : <Button asChild variant="outline"><Link href={backHref}>취소</Link></Button>}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function ApplicationFormContent() {
  const id = useSearchParams().get("operationRecruitmentId");
  if (!id) return <PublicApplyForm />;
  return (
    <MemberAppLayout activePath="/operation-recruitments">
      <OperationApplyForm key={id} id={id} />
    </MemberAppLayout>
  );
}

export default function ApplicationFormPage() {
  return <Suspense fallback={<ApplySkeleton />}><ApplicationFormContent /></Suspense>;
}
