"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  getActiveRecruitment,
  getOperationRecruitmentById,
  getPublicRecruitmentById,
} from "@/lib/api/recruitment";
import { RecruitmentResponse } from "@/lib/interfaces/recruitment";
import { ApplicationAnswers } from "@/lib/interfaces/application";
import {
  FormSchema,
  parseSchema,
  Question,
  validateRequiredAnswers,
} from "@/lib/interfaces/form-builder";
import {
  createApplication,
  createOperationApplication,
} from "@/lib/api/application";
import { getPublicApiErrorMessage } from "@/lib/api/publicClient";
import { toast } from "sonner";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getMe } from "@/lib/api/auth";
import { useMenuNotification } from "@/lib/contexts/MenuNotificationContext";
import { Sidebar } from "@/components/layout/Sidebar";

type RecruitmentStatus = "모집중" | "모집 예정" | "모집 마감";

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function ApplicationFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const operationRecruitmentId = searchParams.get("operationRecruitmentId");
  const publicRecruitmentId = searchParams.get("recruitmentId");
  const operation = Boolean(operationRecruitmentId);
  const backHref = operation
    ? `/operation-recruitments/${operationRecruitmentId}`
    : publicRecruitmentId
      ? `/apply?recruitmentId=${encodeURIComponent(publicRecruitmentId)}`
      : "/apply";
  const { userId, isLoading: authLoading } = useAuth();
  const { markItemViewed } = useMenuNotification();

  const [recruitment, setRecruitment] = useState<RecruitmentResponse | null>(
    null,
  );
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Basic info state
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [major, setMajor] = useState("");
  const [subMajor, setSubMajor] = useState("");
  const [email, setEmail] = useState("");
  const [githubId, setGithubId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Answers state (dynamic)
  const [answers, setAnswers] = useState<ApplicationAnswers>({});

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (operation && !userId) {
        return;
      }

      const [recruitmentData, profile] = await Promise.all([
        operation && operationRecruitmentId
          ? getOperationRecruitmentById(operationRecruitmentId)
          : publicRecruitmentId
            ? getPublicRecruitmentById(publicRecruitmentId)
            : getActiveRecruitment(),
        operation && userId ? getMe() : Promise.resolve(null),
      ]);

      setRecruitment(recruitmentData);
      if (profile) {
        setName(profile.name || "");
        setStudentId(profile.studentId || "");
        setEmail(profile.email || "");
        setGithubId(profile.githubId || "");
        setPhoneNumber(profile.phoneNumber || "");
      }

      const parsedSchema = parseSchema(recruitmentData.form.schema);
      setSchema(parsedSchema);
    } catch (error: unknown) {
      console.error("Failed to load form:", error);
      setError(
        operation
          ? "신청서를 불러오는데 실패했습니다."
          : "지원서를 불러오는데 실패했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [operation, operationRecruitmentId, publicRecruitmentId, userId]);

  useEffect(() => {
    if (operation && authLoading) return;
    if (operation && !userId) {
      const target = `/apply/form?operationRecruitmentId=${encodeURIComponent(operationRecruitmentId || "")}`;
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }
    void loadData();
  }, [
    authLoading,
    loadData,
    operation,
    operationRecruitmentId,
    router,
    userId,
  ]);

  useEffect(() => {
    if (!operation || !recruitment?.id) return;
    void markItemViewed("operation-recruitments", recruitment.id).catch(
      (markError) => {
        console.error("Failed to mark recruitment card read:", markError);
      },
    );
  }, [markItemViewed, operation, recruitment?.id]);

  function getRecruitmentStatus(): RecruitmentStatus {
    if (!recruitment) return "모집 마감";

    const now = new Date();
    const start = new Date(recruitment.startAt);
    const end = new Date(recruitment.endAt);

    if (now < start) return "모집 예정";
    if (now > end) return "모집 마감";
    return "모집중";
  }

  function canSubmit(): boolean {
    if (!recruitment) return false;
    const status = getRecruitmentStatus();
    return status === "모집중" && recruitment.active;
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!operation) {
      if (!name.trim()) newErrors.name = "이름을 입력해주세요.";
      if (!/^\d{8}$/.test(studentId))
        newErrors.studentId = "학번은 숫자 8자리로 입력해주세요.";
      if (!major.trim()) newErrors.major = "전공을 입력해주세요.";
      if (!email.trim()) newErrors.email = "이메일을 입력해주세요.";
      if (!/^\d{3}-\d{4}-\d{4}$/.test(phoneNumber))
        newErrors.phoneNumber =
          "연락처를 000-0000-0000 형식으로 입력해주세요.";
      if (!password.trim()) newErrors.password = "비밀번호를 입력해주세요.";
      else if (password.length < 6)
        newErrors.password = "비밀번호는 6자 이상이어야 합니다.";
      if (!passwordConfirm.trim())
        newErrors.passwordConfirm = "비밀번호 확인을 입력해주세요.";
      else if (password !== passwordConfirm)
        newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    }

    if (schema) {
      Object.assign(newErrors, validateRequiredAnswers(schema, answers));
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit()) {
      toast.error("모집 기간에만 제출할 수 있습니다.");
      return;
    }

    if (!validateForm()) {
      toast.error("입력 항목을 다시 확인해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (operation) {
        await createOperationApplication(recruitment!.id, { answers });
      } else {
        await createApplication({
          name,
          studentId,
          major,
          subMajor: subMajor || undefined,
          email,
          githubId: githubId || undefined,
          phoneNumber,
          answers,
          recruitmentId: recruitment!.id,
          formId: recruitment!.form.id,
          password,
        });
      }

      router.push(
        operation
          ? `/operation-recruitments/complete?recruitmentId=${encodeURIComponent(recruitment!.id)}`
          : `/apply/complete?recruitmentId=${encodeURIComponent(recruitment!.id)}`,
      );
    } catch (error: unknown) {
      console.error("Failed to submit application:", error);
      toast.error(
        getPublicApiErrorMessage(
          error,
          operation
            ? "신청서 제출에 실패했습니다. 다시 시도해주세요."
            : "지원서 제출에 실패했습니다. 다시 시도해주세요.",
        ),
      );
      setIsSubmitting(false);
    }
  }

  function handleAnswerChange(questionId: string, value: string | string[]) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    // Clear error for this question
    if (errors[`q_${questionId}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`q_${questionId}`];
        return newErrors;
      });
    }
  }

  function renderQuestion(question: Question, index: number) {
    const questionKey = `q_${question.id}`;
    const hasError = !!errors[questionKey];
    const currentAnswer = answers[question.id];

    return (
      <div key={question.id} className="space-y-3">
        <div className="flex items-start gap-1">
          <span className="font-semibold text-base shrink-0">{index + 1}.</span>
          <span className="text-base whitespace-pre-wrap wrap-break-word flex-1">
            {question.title}
            {question.required && (
              <span className="text-destructive ml-1">*</span>
            )}
          </span>
        </div>

        {question.type === "SHORT_TEXT" && (
          <Input
            id={question.id}
            value={answers[question.id] || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="답변을 입력하세요"
            disabled={!canSubmit()}
            className={`text-sm${hasError ? " border-destructive" : ""}`}
          />
        )}

        {question.type === "LONG_TEXT" && (
          <Textarea
            id={question.id}
            value={answers[question.id] || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="답변을 입력하세요"
            rows={4}
            disabled={!canSubmit()}
            className={`text-sm${hasError ? " border-destructive" : ""}`}
          />
        )}

        {question.type === "SINGLE_CHOICE" && question.options && (
          <RadioGroup
            value={
              typeof currentAnswer === "string" ? currentAnswer : ""
            }
            onValueChange={(value) => handleAnswerChange(question.id, value)}
            disabled={!canSubmit()}
          >
            {question.options.map((option, optIdx) => (
              <div key={optIdx} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option}
                  id={`${question.id}_${optIdx}`}
                />
                <Label
                  htmlFor={`${question.id}_${optIdx}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {question.type === "MULTIPLE_CHOICE" && question.options && (
          <div className="space-y-2">
            {question.options.map((option, optIdx) => {
              const selectedValues = answers[question.id] || [];
              const isChecked =
                Array.isArray(selectedValues) &&
                selectedValues.includes(option);

              return (
                <div key={optIdx} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}_${optIdx}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const currentValues = Array.isArray(answers[question.id])
                        ? [...answers[question.id]]
                        : [];

                      if (checked) {
                        handleAnswerChange(
                          question.id,
                          option.trim() === "없음"
                            ? [option]
                            : [
                                ...currentValues.filter(
                                  (value) => value.trim() !== "없음",
                                ),
                                option,
                              ],
                        );
                      } else {
                        handleAnswerChange(
                          question.id,
                          currentValues.filter((v) => v !== option),
                        );
                      }
                    }}
                    disabled={!canSubmit()}
                  />
                  <Label
                    htmlFor={`${question.id}_${optIdx}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {hasError && (
          <p className="text-sm text-destructive">{errors[questionKey]}</p>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4">
        <div className="space-y-6">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !recruitment || !schema) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4">
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-4">
              <p className="text-lg text-muted-foreground">
                {error ||
                  (operation
                    ? "신청서를 불러올 수 없습니다"
                    : "지원서를 불러올 수 없습니다")}
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => loadData()} variant="outline">
                  다시 시도
                </Button>
                <Button onClick={() => router.push(backHref)}>돌아가기</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = getRecruitmentStatus();
  const canSubmitForm = canSubmit();

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push(backHref)}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        돌아가기
      </Button>

      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="space-y-6"
      >
        {/* Header */}
        <div className="space-y-3">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <h1 className="min-w-0 flex-1 break-words text-3xl font-bold">
              {recruitment.title}
            </h1>
            <Badge
              className={
                status === "모집중"
                  ? "bg-green-500 text-white"
                  : status === "모집 예정"
                    ? ""
                    : "bg-gray-400"
              }
              variant={status === "모집중" ? "default" : "secondary"}
            >
              {status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            질문에 답변을 작성하고 제출을 부탁드립니다. 작성해 주신 지원서는 감사한 마음으로 신중히 검토하겠습니다.
          </p>
        </div>

        {!canSubmitForm && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                모집 기간에만 제출할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        )}

        <Separator />

        {operation ? (
          <Card>
            <CardHeader>
              <CardTitle>신청자 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-medium">{name}</span>
                <span className="hidden text-muted-foreground sm:inline">·</span>
                <span className="text-sm text-muted-foreground">
                  {studentId}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                로그인한 학회원 정보로 제출됩니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  이름 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.name;
                        return newErrors;
                      });
                    }
                  }}
                  placeholder=""
                  disabled={!canSubmitForm}
                  className={`text-sm${errors.name ? " border-destructive" : ""}`}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentId">
                  학번 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="studentId"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value.replace(/\D/g, "").slice(0, 8));
                    if (errors.studentId) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.studentId;
                        return newErrors;
                      });
                    }
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder=""
                  disabled={!canSubmitForm}
                  readOnly={operation}
                  className={`text-sm${operation ? " bg-muted" : ""}${errors.studentId ? " border-destructive" : ""}`}
                />
                {errors.studentId && (
                  <p className="text-sm text-destructive">{errors.studentId}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="major">
                  전공 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="major"
                  value={major}
                  onChange={(e) => {
                    setMajor(e.target.value);
                    if (errors.major) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.major;
                        return newErrors;
                      });
                    }
                  }}
                  placeholder=""
                  disabled={!canSubmitForm}
                  className={`text-sm${errors.major ? " border-destructive" : ""}`}
                />
                {errors.major && (
                  <p className="text-sm text-destructive">{errors.major}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subMajor">부전공</Label>
                <Input
                  id="subMajor"
                  value={subMajor}
                  onChange={(e) => setSubMajor(e.target.value)}
                  placeholder="선택사항"
                  disabled={!canSubmitForm}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                이메일 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                name="application-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.email;
                      return newErrors;
                    });
                  }
                }}
                placeholder="example@email.com"
                disabled={!canSubmitForm}
                className={`text-sm${errors.email ? " border-destructive" : ""}`}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">
                  연락처 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(formatPhoneNumber(e.target.value));
                    if (errors.phoneNumber) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.phoneNumber;
                        return newErrors;
                      });
                    }
                  }}
                  inputMode="tel"
                  maxLength={13}
                  placeholder="010-0000-0000"
                  disabled={!canSubmitForm}
                  className={`text-sm${errors.phoneNumber ? " border-destructive" : ""}`}
                />
                {errors.phoneNumber && (
                  <p className="text-sm text-destructive">
                    {errors.phoneNumber}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="githubId">GitHub ID</Label>
                <Input
                  id="githubId"
                  value={githubId}
                  onChange={(e) => setGithubId(e.target.value)}
                  placeholder="선택사항"
                  disabled={!canSubmitForm}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  비밀번호 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="application-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.password;
                          return newErrors;
                        });
                      }
                    }}
                    placeholder="6자 이상"
                    disabled={!canSubmitForm}
                    className={`pr-10 text-sm${errors.password ? " border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={!canSubmitForm}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  지원서 조회 시 사용됩니다
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">
                  비밀번호 확인 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="passwordConfirm"
                    name="application-password-confirm"
                    type={showPasswordConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value);
                      if (errors.passwordConfirm) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.passwordConfirm;
                          return newErrors;
                        });
                      }
                    }}
                    placeholder="비밀번호 재입력"
                    disabled={!canSubmitForm}
                    className={`pr-10 text-sm${errors.passwordConfirm ? " border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswordConfirm((visible) => !visible)
                    }
                    disabled={!canSubmitForm}
                    aria-label={
                      showPasswordConfirm
                        ? "비밀번호 확인 숨기기"
                        : "비밀번호 확인 보기"
                    }
                    title={
                      showPasswordConfirm
                        ? "비밀번호 확인 숨기기"
                        : "비밀번호 확인 보기"
                    }
                    className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {showPasswordConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.passwordConfirm && (
                  <p className="text-sm text-destructive">
                    {errors.passwordConfirm}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          </Card>
        )}

        {/* Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle>{operation ? "신청서 질문" : "지원서 질문"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {schema.questions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                질문이 없습니다
              </p>
            ) : (
              schema.questions.map((question, index) =>
                renderQuestion(question, index),
              )
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(backHref)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={!canSubmitForm || isSubmitting}
          >
            {isSubmitting
              ? "제출 중..."
              : operation
                ? "신청하기"
                : "제출하기"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ApplicationFormPage() {
  return (
    <Suspense fallback={null}>
      <ApplicationFormLayout />
    </Suspense>
  );
}

function ApplicationFormLayout() {
  const searchParams = useSearchParams();
  const isOperationRecruitment = Boolean(
    searchParams.get("operationRecruitmentId"),
  );

  if (!isOperationRecruitment) {
    return <ApplicationFormContent />;
  }

  return (
    <div className="flex flex-1">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
        <ApplicationFormContent />
      </main>
    </div>
  );
}
