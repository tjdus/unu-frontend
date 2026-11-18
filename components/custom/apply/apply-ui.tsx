"use client";

import Link from "next/link";
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { HomeScrollDivider } from "@/components/custom/home-scroll-divider";
import { cn } from "@/lib/utils";
import type { ApplicationAnswers } from "@/lib/interfaces/application";
import type { Question } from "@/lib/interfaces/form-builder";
import type { QuarterResponse } from "@/lib/interfaces/quarter";
import type { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import styles from "./apply.module.css";

export { styles as applyStyles };

/* ── Recruitment helpers ─────────────────────────────────────────── */

export type RecruitmentStatus = "모집중" | "모집 예정" | "모집 마감";

export function getRecruitmentStatus(recruitment: RecruitmentResponse | null): RecruitmentStatus {
  if (!recruitment) return "모집 마감";
  const now = Date.now();
  if (now < new Date(recruitment.startAt).getTime()) return "모집 예정";
  if (now > new Date(recruitment.endAt).getTime()) return "모집 마감";
  return "모집중";
}

export function canApplyTo(recruitment: RecruitmentResponse | null) {
  return Boolean(recruitment?.active) && getRecruitmentStatus(recruitment) === "모집중";
}

/** "26 SPRING" */
export function formatQuarterLabel(quarter: QuarterResponse) {
  return `${String(quarter.year).slice(2)} ${quarter.season.toUpperCase()}`;
}

/** "2026.03.02" */
export function formatDot(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/** "23:59" */
export function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

/** "3월 15일 (일) 23:59" */
export function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day} (${weekday}) ${time}`;
}

/* ── Page chrome ─────────────────────────────────────────────────── */

export type Crumb = { label: string; href?: string; onClick?: () => void };

export function ApplyHero({
  crumbs,
  display,
  title,
  description,
  meta,
  aside,
}: {
  crumbs: Crumb[];
  display: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={styles.hero} aria-labelledby="apply-title">
      <nav className={styles.crumbs} aria-label="위치">
        {crumbs.map((crumb, index) => {
          const content = (
            <>
              {index === 0 && <ArrowLeft className="size-3.5" aria-hidden="true" />}
              {crumb.label}
            </>
          );
          return (
            <span key={crumb.label} className="contents">
              {index > 0 && <span aria-hidden="true">/</span>}
              {crumb.href ? (
                <Link href={crumb.href}>{content}</Link>
              ) : crumb.onClick ? (
                <button type="button" onClick={crumb.onClick}>{content}</button>
              ) : (
                <span aria-current="page">{content}</span>
              )}
            </span>
          );
        })}
      </nav>
      <p className={styles.bigTitle} aria-hidden="true" lang="en">{display}</p>
      <div className={styles.intro}>
        <div className={styles.introTitle}>
          <h1 id="apply-title">{title}</h1>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {(description || aside) && (
          <div className={styles.introDesc}>
            {description && <p>{description}</p>}
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}

export function ApplyDivider() {
  return (
    <div className={styles.divider}>
      <HomeScrollDivider />
    </div>
  );
}

export function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={cn(styles.chip, active && styles.chipActive)}>{children}</span>;
}

export function StatusChip({ status }: { status: RecruitmentStatus }) {
  return <Chip active={status === "모집중"}>{status}</Chip>;
}

/** Which section is being read: the last one whose top has passed 35% of the viewport
 *  (the last section once the page is scrolled to the bottom). */
function useCurrentSection(ids: string[]) {
  const [current, setCurrent] = useState(ids[0] ?? "");
  const key = ids.join("|");

  useEffect(() => {
    const sectionIds = key ? key.split("|") : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let next = sectionIds[0] ?? "";
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) next = id;
      }
      if (atBottom && sectionIds.length) next = sectionIds[sectionIds.length - 1];
      setCurrent(next);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);

  return current;
}

export function SectionNav({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const current = useCurrentSection(items.map((item) => item.href.replace(/^#/, "")));

  return (
    <nav className={styles.nav} aria-label={label}>
      <span className={styles.navLabel}>{label}</span>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.href === `#${current}` ? "location" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function SectionHead({ tag, title, note, id }: { tag?: string; title: string; note?: string; id?: string }) {
  return (
    <div className={styles.sectionHead}>
      <div>
        {tag && <span className={styles.tag} lang="en">{tag}</span>}
        <h2 id={id}>{title}</h2>
      </div>
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}

export function ApplySkeleton() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="불러오는 중">
      <div className={cn(styles.hero, styles.skeleton)}>
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}

/* ── Fields ──────────────────────────────────────────────────────── */

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  required?: boolean;
  error?: string;
  support?: string;
  /** Password field with a show/hide toggle. */
  secret?: boolean;
};

export function Field({ label, required, error, support, secret, type, disabled, ...input }: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-error` : support ? `${id}-support` : undefined;

  return (
    <div className={styles.field}>
      <div className={styles.fieldBox}>
        <label htmlFor={id}>
          {label}
          {required && <span className={styles.required} aria-hidden="true">*</span>}
        </label>
        <input
          {...input}
          id={id}
          type={secret ? (visible ? "text" : "password") : type}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          data-has-toggle={secret ? "" : undefined}
          className={styles.input}
        />
        {secret && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setVisible((value) => !value)}
            disabled={disabled}
            aria-label={visible ? `${label} 숨기기` : `${label} 보기`}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">{error}</p>
      ) : support ? (
        <p id={`${id}-support`} className={styles.support}>{support}</p>
      ) : null}
    </div>
  );
}

/* ── Questions ───────────────────────────────────────────────────── */

/** Same limit as the server (ApplicationAnswerValidator.MAX_TEXT_LENGTH). */
export const MAX_ANSWER_LENGTH = 20_000;

/** Keeps only answers to questions in the schema — the server rejects answers to unknown questions. */
export function answersForSchema(questions: Question[], answers: ApplicationAnswers): ApplicationAnswers {
  const result: ApplicationAnswers = {};
  for (const question of questions) {
    if (answers[question.id] !== undefined) result[question.id] = answers[question.id];
  }
  return result;
}

/** Picking "없음" clears the other options, and any other option clears "없음". */
export function toggleMultipleChoice(current: string[], option: string, checked: boolean) {
  if (!checked) return current.filter((value) => value !== option);
  if (option.trim() === "없음") return [option];
  return [...current.filter((value) => value.trim() !== "없음"), option];
}

function QuestionHead({ question, index, labelId }: { question: Question; index: number; labelId: string }) {
  return (
    <div className={styles.questionHead}>
      <span lang="en">Q{index + 1}</span>
      <p id={labelId}>
        {question.title}
        {question.required && <span className={styles.required} aria-label="필수">*</span>}
      </p>
    </div>
  );
}

export function QuestionInput({
  question,
  index,
  value,
  error,
  disabled,
  onChange,
}: {
  question: Question;
  index: number;
  value: ApplicationAnswers[string] | undefined;
  error?: string;
  disabled?: boolean;
  onChange: (value: string | string[]) => void;
}) {
  const labelId = useId();
  const errorId = `${labelId}-error`;
  const text = typeof value === "string" ? value : "";
  const selected = Array.isArray(value) ? value : [];
  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  return (
    <div className={styles.question} id={`question-${question.id}`}>
      <QuestionHead question={question} index={index} labelId={labelId} />

      {question.type === "SHORT_TEXT" && (
        <input
          className={styles.input}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder="답변을 입력하세요"
          maxLength={MAX_ANSWER_LENGTH}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-required={question.required || undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}

      {question.type === "LONG_TEXT" && (
        <>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            placeholder="답변을 입력하세요"
            rows={6}
            maxLength={MAX_ANSWER_LENGTH}
            disabled={disabled}
            aria-labelledby={labelId}
            aria-required={question.required || undefined}
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
          <span className={styles.count}>
            {text.length.toLocaleString("ko-KR")} / {MAX_ANSWER_LENGTH.toLocaleString("ko-KR")}자
          </span>
        </>
      )}

      {question.type === "SINGLE_CHOICE" && (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          aria-required={question.required || undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(styles.choices, error && styles.choicesInvalid)}
        >
          {(question.options ?? []).map((option) => (
            <label key={option} className={styles.choice}>
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={text === option}
                onChange={() => onChange(option)}
                disabled={disabled}
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.type === "MULTIPLE_CHOICE" && (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          className={cn(styles.choices, error && styles.choicesInvalid)}
        >
          {(question.options ?? []).map((option) => (
            <label key={option} className={styles.choice}>
              <input
                type="checkbox"
                value={option}
                checked={selected.includes(option)}
                onChange={(event) => onChange(toggleMultipleChoice(selected, option, event.target.checked))}
                disabled={disabled}
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {error && <p id={errorId} className={styles.fieldError} role="alert">{error}</p>}
    </div>
  );
}

export function QuestionAnswer({
  question,
  index,
  value,
}: {
  question: Question;
  index: number;
  value: ApplicationAnswers[string] | undefined;
}) {
  const labelId = useId();
  const empty = value === undefined || (Array.isArray(value) ? value.length === 0 : !value.trim());

  return (
    <div className={styles.question}>
      <QuestionHead question={question} index={index} labelId={labelId} />
      <div className={styles.answer} aria-labelledby={labelId}>
        {empty ? (
          <span className={styles.answerEmpty}>답변하지 않았습니다</span>
        ) : Array.isArray(value) ? (
          <ul>{value.map((item) => <li key={item}>{item}</li>)}</ul>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
