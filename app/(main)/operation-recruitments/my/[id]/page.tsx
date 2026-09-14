"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { applicationStatusTone } from "@/lib/constants/status-badge-tones";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelMyOperationApplication,
  getMyOperationApplication,
  updateMyOperationApplication,
} from "@/lib/api/application";
import {
  ApplicationAnswers,
  ApplicationResponse,
} from "@/lib/interfaces/application";
import {
  FormSchema,
  Question,
  parseSchema,
  validateRequiredAnswers,
} from "@/lib/interfaces/form-builder";
import { toast } from "sonner";
import { useMenuNotification } from "@/lib/contexts/MenuNotificationContext";

// 이 페이지는 학회 내부 신청/모집(INTERNAL_OPERATION) 전용이므로 승인/미승인 문구를 쓴다.
const STATUS_LABELS: Record<string, string> = {
  APPLIED: "제출됨",
  IN_PROGRESS: "검토 중",
  PASSED: "승인",
  REJECTED: "미승인",
  CANCELED: "취소됨",
};

function parseAnswers(value: string | ApplicationAnswers): ApplicationAnswers {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as ApplicationAnswers;
  } catch {
    return {};
  }
}

function displayAnswer(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "-";
  return value?.trim() || "-";
}

export default function MyOperationApplicationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const fromRecruitmentId = searchParams.get("recruitmentId");
  let backPath = "/operation-recruitments/my";
  let backLabel = "내 신청 내역";
  if (from === "recruitment-detail" && fromRecruitmentId) {
    backPath = `/operation-recruitments/${fromRecruitmentId}`;
    backLabel = "모집 안내";
  } else if (from === "recruitments") {
    backPath = "/operation-recruitments";
    backLabel = "학회 내부 신청/모집";
  }
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState<ApplicationAnswers>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const { markItemViewed } = useMenuNotification();

  const loadApplication = useCallback(async () => {
    try {
      setLoading(true);
      const loaded = await getMyOperationApplication(params.id);
      setApplication(loaded);
      setDraftAnswers(parseAnswers(loaded.answers));
    } catch (error) {
      console.error("Failed to load operation application:", error);
      toast.error("신청서를 불러오지 못했습니다.");
      router.replace("/operation-recruitments/my");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  useEffect(() => {
    if (!application?.recruitmentId) return;
    void markItemViewed(
      "operation-recruitments",
      application.recruitmentId,
    ).catch((error) => {
      console.error("Failed to mark recruitment card read:", error);
    });
  }, [application?.recruitmentId, markItemViewed]);

  const schema = useMemo<FormSchema | null>(() => {
    if (!application) return null;
    return parseSchema(application.formSnapshot);
  }, [application]);
  const submittedAnswers = useMemo(
    () => (application ? parseAnswers(application.answers) : {}),
    [application],
  );

  function handleAnswerChange(questionId: string, value: string | string[]) {
    setDraftAnswers((current) => ({ ...current, [questionId]: value }));
    setAnswerErrors((current) => {
      const next = { ...current };
      delete next[`q_${questionId}`];
      return next;
    });
  }

  function startEditing() {
    setDraftAnswers(submittedAnswers);
    setAnswerErrors({});
    setEditing(true);
  }

  function cancelEditing() {
    setDraftAnswers(submittedAnswers);
    setAnswerErrors({});
    setEditing(false);
  }

  async function handleSave() {
    if (!application || !schema) return;
    const validationErrors = validateRequiredAnswers(schema, draftAnswers);
    setAnswerErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error("필수 질문에 모두 답변해주세요.");
      return;
    }
    try {
      setSaving(true);
      const updated = await updateMyOperationApplication(application.id, {
        answers: draftAnswers,
      });
      setApplication(updated);
      setDraftAnswers(parseAnswers(updated.answers));
      setEditing(false);
      toast.success("신청서가 수정되었습니다.");
    } catch (error) {
      console.error("Failed to update operation application:", error);
      toast.error("신청서를 수정하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!application) return;
    try {
      setCanceling(true);
      await cancelMyOperationApplication(application.id);
      toast.success("신청이 취소되었습니다.");
      router.replace("/operation-recruitments");
    } catch (error) {
      console.error("Failed to cancel operation application:", error);
      toast.error("신청을 취소하지 못했습니다.");
    } finally {
      setCanceling(false);
    }
  }

  function renderQuestion(question: Question, index: number) {
    const value = draftAnswers[question.id];
    const error = answerErrors[`q_${question.id}`];

    return (
      <div key={question.id} className="space-y-3 py-5 first:pt-0 last:pb-0">
        <Label className="text-sm font-medium">
          {index + 1}. {question.title}
          {question.required && <span className="ml-1 text-destructive">*</span>}
        </Label>

        {question.type === "SHORT_TEXT" && (
          <Input
            value={typeof value === "string" ? value : ""}
            onChange={(event) =>
              handleAnswerChange(question.id, event.target.value)
            }
          />
        )}

        {question.type === "LONG_TEXT" && (
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(event) =>
              handleAnswerChange(question.id, event.target.value)
            }
            rows={5}
          />
        )}

        {question.type === "SINGLE_CHOICE" && (
          <RadioGroup
            value={typeof value === "string" ? value : ""}
            onValueChange={(nextValue) =>
              handleAnswerChange(question.id, nextValue)
            }
            className="space-y-2"
          >
            {(question.options || []).map((option) => (
              <div key={option} className="flex items-center gap-2">
                <RadioGroupItem
                  value={option}
                  id={`${question.id}-${option}`}
                />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="font-normal"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {question.type === "MULTIPLE_CHOICE" && (
          <div className="space-y-2">
            {(question.options || []).map((option) => {
              const currentValues = Array.isArray(value) ? value : [];
              return (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    id={`${question.id}-${option}`}
                    checked={currentValues.includes(option)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleAnswerChange(
                          question.id,
                          option.trim() === "없음"
                            ? [option]
                            : [
                                ...currentValues.filter(
                                  (item) => item.trim() !== "없음",
                                ),
                                option,
                              ],
                        );
                      } else {
                        handleAnswerChange(
                          question.id,
                          currentValues.filter((item) => item !== option),
                        );
                      }
                    }}
                  />
                  <Label
                    htmlFor={`${question.id}-${option}`}
                    className="font-normal"
                  >
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (loading || !application) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 px-6 py-8">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => router.push(backPath)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {application.recruitmentTitle}
            </h1>
            <Badge
              variant="outline"
              className={applicationStatusTone(application.status)}
            >
              {STATUS_LABELS[application.status] || application.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(application.submittedAt || application.createdAt).toLocaleString("ko-KR")}
          </p>
        </div>
        {application.status === "APPLIED" && !editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              신청서 수정
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  신청 취소
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>신청을 취소하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    신청서는 내 신청 내역에서 삭제되며, 모집 기간 중 다시
                    신청할 수 있습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>돌아가기</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={canceling}
                  >
                    {canceling ? "취소 중..." : "신청 취소"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>신청자 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
            <span className="font-medium">{application.name}</span>
            <span className="hidden text-muted-foreground sm:inline">·</span>
            <span className="text-sm text-muted-foreground">
              {application.studentId}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>제출한 답변</CardTitle>
          {editing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                취소
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="divide-y">
          {!schema || schema.questions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              별도로 제출한 답변이 없습니다.
            </p>
          ) : (
            schema.questions.map((question, index) =>
              editing ? (
                renderQuestion(question, index)
              ) : (
                <div
                  key={question.id}
                  className="space-y-2 py-4 first:pt-0 last:pb-0"
                >
                  <p className="text-sm font-medium">
                    {index + 1}. {question.title}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {displayAnswer(submittedAnswers[question.id])}
                  </p>
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
