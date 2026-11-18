"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ApplicationAnswers, ApplicationResponse } from "@/lib/interfaces/application";
import { parseSchema, type SchemaValue } from "@/lib/interfaces/form-builder";
import { formatDateTime } from "@/lib/utils/date-utils";
import { ApplicationEmail } from "./application-email";

type Props = {
  applications: ApplicationResponse[];
  questions: SchemaValue;
  useApprovalLabels: boolean;
  renderStatus: (status: string) => ReactNode;
};

function parseAnswers(value: ApplicationResponse["answers"]): ApplicationAnswers {
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as ApplicationAnswers
      : {};
  } catch {
    return {};
  }
}

function formatAnswer(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const choices = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
    if (choices.length > 0) return choices.join(", ");
  }
  return "—";
}

export default function ApplicationAnswersTable({
  applications, questions, useApprovalLabels, renderStatus,
}: Props) {
  const { rows, questionColumns } = useMemo(() => {
    const rows = [...applications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((application) => ({ application, answers: parseAnswers(application.answers) }));
    const columns = new Map(parseSchema(questions).questions.map((question) => [question.id, question]));
    for (const { application, answers } of rows) {
      for (const question of parseSchema(application.formSnapshot).questions) {
        if (!columns.has(question.id) && Object.hasOwn(answers, question.id)) {
          columns.set(question.id, question);
        }
      }
    }
    return { rows, questionColumns: [...columns.values()] };
  }, [applications, questions]);

  const columns: { key: string; label: string; width: number; cell: (application: ApplicationResponse) => ReactNode }[] = [
    { key: "name", label: "이름", width: 120, cell: (app) => (
      <Link href={`/manage/applications/${app.id}`} prefetch={false} className="font-medium hover:underline">
        {app.name || "—"}
      </Link>
    ) },
    { key: "studentId", label: "학번", width: 106, cell: (app) => app.studentId },
    { key: "major", label: "전공", width: 160, cell: (app) => app.major },
    { key: "subMajor", label: "복수·부전공", width: 148, cell: (app) => app.subMajor },
    { key: "email", label: "이메일", width: 264, cell: (app) => <ApplicationEmail email={app.email} /> },
    { key: "phoneNumber", label: "연락처", width: 140, cell: (app) => app.phoneNumber },
    { key: "githubId", label: "GitHub ID", width: 144, cell: (app) => app.githubId },
    { key: "status", label: "상태", width: 92, cell: (app) => renderStatus(app.status) },
    { key: "submittedAt", label: useApprovalLabels ? "신청일" : "지원일", width: 156, cell: (app) => formatDateTime(app.submittedAt || app.createdAt) },
  ];
  const questionWidths = questionColumns.map((question) => question.type === "LONG_TEXT" ? 320 : 232);
  const minWidth = columns.reduce((sum, column) => sum + column.width, 0)
    + questionWidths.reduce((sum, width) => sum + width, 0);

  if (rows.length === 0) return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {useApprovalLabels ? "신청자가 없습니다." : "지원자가 없습니다."}
    </p>
  );

  return (
    <div
      role="region"
      aria-label="신청 기본 정보 및 문항별 답변"
      tabIndex={0}
      className="relative max-h-[min(62dvh,38rem)] min-w-0 max-w-full overflow-auto overscroll-x-contain rounded-sm border focus-visible:outline-2 focus-visible:outline-ring"
    >
      <table data-slot="table" aria-label="전체 신청 내용" className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth }}>
        <colgroup>
          {columns.map((column) => <col key={column.key} style={{ width: column.width }} />)}
          {questionColumns.map((question, index) => <col key={question.id} style={{ width: questionWidths[index] }} />)}
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.key} scope="col" className={`sticky top-0 z-10 border-b bg-muted px-3 ${column.key === "name" ? "left-0 z-20 border-r" : ""}`}>
                {column.label}
              </TableHead>
            ))}
            {questionColumns.map((question) => (
              <TableHead key={question.id} scope="col" className="sticky top-0 z-10 whitespace-pre-wrap wrap-anywhere border-b border-l bg-muted px-3 py-2.5">
                {question.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ application, answers }) => (
            <TableRow key={application.id} className="group">
              {columns.map((column) => (
                <TableCell key={column.key} className={`whitespace-normal wrap-anywhere border-b px-3 py-2.5 align-top ${column.key === "name" ? "sticky left-0 z-[1] border-r bg-background group-hover:bg-muted" : ""}`}>
                  {column.cell(application) || "—"}
                </TableCell>
              ))}
              {questionColumns.map((question) => (
                <TableCell key={question.id} className="whitespace-pre-wrap wrap-anywhere border-b border-l px-3 py-2.5 align-top">
                  {formatAnswer(Object.hasOwn(answers, question.id) ? answers[question.id] : undefined)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
