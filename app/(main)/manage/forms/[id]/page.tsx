"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  FileText,
  File,
  ChevronDown,
  ChevronUp,
  Users,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FormPreview } from "@/components/custom/form/form-preview";
import { parseSchema } from "@/lib/interfaces/form-builder";
import {} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import { getFormById, deleteForm } from "@/lib/api/form";
import { FormResponse } from "@/lib/interfaces/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils/date-utils";
import { getFormSubmissionsByFormId } from "@/lib/api/form-submission";
import { FormSubmissionResponseDto } from "@/lib/interfaces/form-submission";

// ========================
// STATISTICS HELPERS
// ========================

interface OptionStat {
  label: string;
  count: number;
  percentage: number;
  submitters: { name: string; studentId: string }[];
}

interface QuestionStat {
  id: string;
  title: string;
  type: string;
  totalResponses: number;
  options?: OptionStat[];
}

function computeStats(
  schema: ReturnType<typeof parseSchema>,
  submissions: FormSubmissionResponseDto[],
): QuestionStat[] {
  return schema.questions.map((q) => {
    const total = submissions.length;

    if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") {
      const optionMap = new Map<
        string,
        { name: string; studentId: string }[]
      >();
      (q.options ?? []).forEach((opt) => optionMap.set(opt, []));

      submissions.forEach((sub) => {
        const answer = sub.answers?.[q.id];
        const selected = Array.isArray(answer)
          ? answer
          : answer
            ? [answer]
            : [];
        const submitter = {
          name: sub.createdBy?.name || "알 수 없음",
          studentId: sub.createdBy?.studentId || "",
        };
        selected.forEach((opt) => {
          if (!optionMap.has(opt)) optionMap.set(opt, []);
          optionMap.get(opt)!.push(submitter);
        });
      });

      const options: OptionStat[] = Array.from(optionMap.entries()).map(
        ([label, submitters]) => ({
          label,
          count: submitters.length,
          percentage:
            total > 0 ? Math.round((submitters.length / total) * 100) : 0,
          submitters,
        }),
      );

      return {
        id: q.id,
        title: q.title,
        type: q.type,
        totalResponses: total,
        options,
      };
    }

    const responded = submissions.filter((sub) => {
      const a = sub.answers?.[q.id];
      return a !== undefined && a !== null && a !== "";
    }).length;

    return {
      id: q.id,
      title: q.title,
      type: q.type,
      totalResponses: responded,
    };
  });
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm font-medium">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function ViewFormPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<FormResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submissions, setSubmissions] = useState<FormSubmissionResponseDto[]>(
    [],
  );
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadForm();
  }, [id]);

  async function loadForm() {
    try {
      setIsLoading(true);
      const data = await getFormById(id);
      setForm(data);
    } catch (error: any) {
      console.error("Failed to load form:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSubmissions() {
    setSubmissionsLoading(true);
    try {
      const data = await getFormSubmissionsByFormId(id);
      setSubmissions(data);
    } catch (error: any) {
      console.error("Failed to load submissions:", error);
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteForm(id);
      router.push("/manage/forms");
    } catch (error: any) {
      console.error("Failed to delete form:", error);
      setDeleteDialogOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        {/* Back button */}
        <Skeleton className="h-9 w-24" />

        {/* Tabs */}
        <div className="space-y-4">
          <Skeleton className="h-9 w-52" />

          {/* 기본 정보 Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 divide-y">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 신청서 구조 및 미리보기 Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-96 w-full rounded-md" />
                <Skeleton className="h-96 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* 메타 정보 Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">신청서를 찾을 수 없습니다</p>
          <Button className="mt-4" onClick={() => router.push("/manage/forms")}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/manage/forms")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>

        <h1 className="text-xl font-bold tracking-tight">{form.title}</h1>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="info"
        className="space-y-4"
        onValueChange={(v) => v === "applications" && loadSubmissions()}
      >
        <TabsList>
          <TabsTrigger value="info" className="px-4 py-2">
            기본 정보
          </TabsTrigger>
          <TabsTrigger value="applications" className="px-4 py-2">
            신청 내역
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 기본 정보 */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y">
                <InfoRow
                  icon={<FileText className="h-4 w-4" />}
                  label="신청서 제목"
                  value={form.title}
                />
                {form.description && (
                  <InfoRow
                    icon={<FileText className="h-4 w-4" />}
                    label="설명"
                    value={
                      <span className="whitespace-pre-wrap font-normal">
                        {form.description
                          .split(/(\[[^\]]+\]\([^)]+\))/g)
                          .map((part, i) => {
                            const match = part.match(
                              /^\[([^\]]+)\]\(([^)]+)\)$/,
                            );
                            if (match) {
                              return (
                                <a
                                  key={i}
                                  href={match[2]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline underline-offset-2 hover:opacity-80"
                                >
                                  {match[1]}
                                </a>
                              );
                            }
                            return part;
                          })}
                      </span>
                    }
                  />
                )}
                <InfoRow
                  icon={<File className="h-4 w-4" />}
                  label="신청서 템플릿"
                  value={form.template?.title}
                />

              </div>
            </CardContent>
          </Card>

          {/* Schema and Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                신청서 구조 및 미리보기
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Preview */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">미리보기</h3>
                  <ScrollArea className="h-150 w-full">
                    <FormPreview schema={parseSchema(form.schema)} />
                  </ScrollArea>
                </div>
                {/* Schema JSON */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">스키마 (JSON)</h3>
                  <ScrollArea className="h-150 w-full rounded-md border bg-muted/50">
                    <pre className="p-4 text-sm font-mono">{form.schema}</pre>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meta Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                메타 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4">
                <div className="text-sm font-medium text-muted-foreground">
                  생성일
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(form.createdAt)}
                </div>

                <div className="text-sm font-medium text-muted-foreground">
                  수정일
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(form.modifiedAt)}
                </div>

                <div className="text-sm font-medium text-muted-foreground">
                  생성자
                </div>
                <div className="text-sm text-muted-foreground">
                  {form.createdBy?.name || "알 수 없음"}
                </div>

                <div className="text-sm font-medium text-muted-foreground">
                  수정자
                </div>
                <div className="text-sm text-muted-foreground">
                  {form.modifiedBy?.name || "알 수 없음"}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: 신청 내역 */}
        <TabsContent value="applications" className="space-y-4">
          {/* 통계 Card */}
          {!submissionsLoading &&
            submissions.length > 0 &&
            (() => {
              const schema = parseSchema(form.schema);
              const stats = computeStats(schema, submissions);
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4" />
                      응답 통계
                      <Badge variant="secondary">
                        {submissions.length}명 응답
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {stats.map((stat, idx) => (
                      <div key={stat.id} className="space-y-2">
                        <p className="text-sm font-medium">
                          {idx + 1}. {stat.title}
                        </p>

                        {stat.options ? (
                          <div className="space-y-2.5">
                            {stat.options.map((opt) => (
                              <div key={opt.label} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground truncate max-w-[60%]">
                                    {opt.label}
                                  </span>
                                  <span className="font-medium tabular-nums shrink-0">
                                    {opt.count}명 ({opt.percentage}%)
                                  </span>
                                </div>
                                {/* Progress bar */}
                                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${opt.percentage}%` }}
                                  />
                                </div>
                                {/* Submitters */}
                                {opt.submitters.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {opt.submitters.map((s, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                                      >
                                        {s.name}
                                        {s.studentId && (
                                          <span className="text-muted-foreground/60">
                                            {s.studentId}
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {stat.totalResponses}명 응답
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                신청 내역
                {!submissionsLoading && (
                  <Badge variant="secondary">{submissions.length}건</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : submissions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  아직 신청 내역이 없습니다
                </p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub) => {
                    const isExpanded = expandedId === sub.id;
                    const schema = (() => {
                      try {
                        return parseSchema(
                          typeof sub.formSnapshot === "string"
                            ? sub.formSnapshot
                            : JSON.stringify(sub.formSnapshot),
                        );
                      } catch {
                        return null;
                      }
                    })();

                    return (
                      <div
                        key={sub.id}
                        className="rounded-md border overflow-hidden"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : sub.id)
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                {sub.createdBy?.name || "알 수 없음"}
                                {sub.createdBy?.studentId && (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    {sub.createdBy.studentId}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(
                                  sub.submittedAt || sub.createdAt,
                                )}
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t bg-muted/30 px-4 py-4 space-y-3">
                            {schema ? (
                              schema.questions.map((q) => {
                                const answer = sub.answers?.[q.id];
                                const displayAnswer = Array.isArray(answer)
                                  ? answer.join(", ")
                                  : (answer ?? "—");
                                return (
                                  <div key={q.id} className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {q.title}
                                    </p>
                                    <p className="text-sm whitespace-pre-wrap">
                                      {displayAnswer || "—"}
                                    </p>
                                  </div>
                                );
                              })
                            ) : (
                              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                                {JSON.stringify(sub.answers, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => router.push(`/manage/forms/${id}/edit`)}
          >
            <Pencil className="h-3 w-3" />
            <span className="text-xs">수정</span>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            <span className="text-xs">삭제</span>
          </Button>
        </div>
      </Tabs>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={form.title || ""}
        onConfirm={handleDelete}
      />
    </div>
  );
}
