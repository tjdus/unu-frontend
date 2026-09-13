"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRecruitment, updateRecruitment } from "@/lib/api/recruitment";
import { getAllForms, getFormById } from "@/lib/api/form";
import { getAllQuarters } from "@/lib/api/quarter";
import { FormResponse } from "@/lib/interfaces/form";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import {
  RecruitmentResponse,
  RecruitmentType,
} from "@/lib/interfaces/recruitment";
import {
  FormSchema,
  parseSchema,
  QUESTION_TYPE_LABELS,
} from "@/lib/interfaces/form-builder";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface RecruitmentFormProps {
  mode: "create" | "edit";
  initialData?: RecruitmentResponse;
}

export default function RecruitmentForm({
  mode,
  initialData,
}: RecruitmentFormProps) {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [completionMessage, setCompletionMessage] = useState(
    initialData?.completionMessage || "",
  );
  const [startAt, setStartAt] = useState(
    initialData?.startAt ? initialData.startAt : "",
  );
  const [endAt, setEndAt] = useState(
    initialData?.endAt ? initialData.endAt : "",
  );
  const [quarterId, setQuarterId] = useState(initialData?.quarter.id || "");
  const [formId, setFormId] = useState(initialData?.form.id || "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [type, setType] = useState<RecruitmentType>(
    initialData?.type || "NEW_MEMBER",
  );

  // Data loading
  const [forms, setForms] = useState<FormResponse[]>([]);
  const [quarters, setQuarters] = useState<QuarterResponse[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [quartersLoading, setQuartersLoading] = useState(true);

  // Form preview
  const [selectedForm, setSelectedForm] = useState<FormResponse | null>(
    initialData?.form || null,
  );
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
    loadQuarters();
  }, []);

  useEffect(() => {
    // Load initial form preview if in edit mode
    if (mode === "edit" && initialData?.form) {
      const schema = parseSchema(initialData.form.schema);
      setFormSchema(schema);
    }
  }, [mode, initialData]);

  async function loadForms() {
    try {
      setFormsLoading(true);
      const data = await getAllForms();
      setForms(data);
    } catch (error: any) {
      console.error("Failed to load forms:", error);
    } finally {
      setFormsLoading(false);
    }
  }

  async function loadQuarters() {
    try {
      setQuartersLoading(true);
      const data = await getAllQuarters();
      setQuarters(data);
    } catch (error: any) {
      console.error("Failed to load quarters:", error);
    } finally {
      setQuartersLoading(false);
    }
  }

  async function handleFormSelect(selectedFormId: string) {
    setFormId(selectedFormId);
    if (!selectedFormId) {
      setSelectedForm(null);
      setFormSchema(null);
      return;
    }

    try {
      setFormLoading(true);
      const form = await getFormById(selectedFormId);
      setSelectedForm(form);
      const schema = parseSchema(form.schema);
      setFormSchema(schema);
    } catch (error: any) {
      console.error("Failed to load form:", error);
      setFormSchema(null);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !formId || !quarterId || !startAt || !endAt) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    if (new Date(startAt) >= new Date(endAt)) {
      setError("종료 일시는 시작 일시보다 이후여야 합니다.");
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);
      const payload = {
        title,
        description,
        completionMessage,
        startAt: startAt,
        endAt: endAt,
        quarterId: quarterId,
        formId: formId,
        active,
        type,
      };

      if (mode === "create") {
        await createRecruitment(payload);
        router.push("/manage/recruitments");
      } else {
        const updated = await updateRecruitment(initialData!.id, payload);
        router.push(`/manage/recruitments/${updated.id}`);
      }
    } catch (error: any) {
      console.error(`Failed to ${mode} recruitment:`, error);
      setError(`모집 ${mode === "create" ? "생성" : "수정"}에 실패했습니다.`);
      setIsSubmitting(false);
    }
  }

  const submitButtonText =
    mode === "create"
      ? isSubmitting
        ? "생성 중..."
        : "모집 생성"
      : isSubmitting
        ? "수정 중..."
        : "모집 수정";

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recruitment Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>모집 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recruitmentType">
                  모집 유형 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={type}
                  onValueChange={(value: RecruitmentType) => setType(value)}
                >
                  <SelectTrigger id="recruitmentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW_MEMBER">
                      신규 학회원 모집
                    </SelectItem>
                    <SelectItem value="INTERNAL_OPERATION">
                      학회 내부 신청/모집
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  신규 학회원 모집은 홈과 지원 안내에, 학회 내부 신청/모집은
                  로그인 후 학회 내부 신청/모집 탭에 표시됩니다.
                </p>
              </div>

              <Separator />

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  모집 제목 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="모집 제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                {mode === "create" ? (
                  <div className="relative h-36">
                    <Textarea
                      id="description"
                      placeholder="모집에 대한 설명을 입력하세요"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={6}
                      className="absolute left-0 top-0 z-30 min-h-36 w-full resize-none bg-background text-sm leading-relaxed shadow-none transition-[width,min-height,box-shadow,transform] duration-200 focus:min-h-64 focus:shadow-[0_18px_45px_rgb(15_23_42_/_0.18)] lg:focus:min-h-96 lg:focus:w-[calc(200%+1.5rem)] lg:focus:-translate-x-8"
                    />
                  </div>
                ) : (
                  <Textarea
                    id="description"
                    placeholder="모집에 대한 설명을 입력하세요"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="completionMessage">
                  {type === "INTERNAL_OPERATION"
                    ? "신청 완료 안내 메세지"
                    : "지원 완료 안내 메세지"}
                </Label>
                <Textarea
                  id="completionMessage"
                  placeholder={
                    type === "INTERNAL_OPERATION"
                      ? "신청자가 신청 완료 시 볼 수 있는 메세지입니다."
                      : "지원자가 지원 완료 시 볼 수 있는 메세지입니다."
                  }
                  value={completionMessage}
                  onChange={(e) => setCompletionMessage(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {type === "INTERNAL_OPERATION" ? "신청" : "지원"} 완료
                  화면에 표시됩니다. 비워두면 기본 안내만 표시됩니다.
                </p>
              </div>

              {/* Quarter */}
              <div className="space-y-2">
                <Label htmlFor="quarter">
                  분기 선택 <span className="text-destructive">*</span>
                </Label>
                {quartersLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={quarterId} onValueChange={setQuarterId}>
                    <SelectTrigger id="quarter">
                      <SelectValue placeholder="분기를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {quarters.map((quarter) => (
                        <SelectItem key={quarter.id} value={quarter.id}>
                          {quarter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Start Date */}
              <div className="space-y-2">
                <Label>
                  모집 시작 <span className="text-destructive">*</span>
                </Label>
                <DateTimePicker
                  value={startAt}
                  onChange={setStartAt}
                  placeholder="시작 일시를 선택하세요"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label>
                  모집 종료 <span className="text-destructive">*</span>
                </Label>
                <DateTimePicker
                  value={endAt}
                  onChange={setEndAt}
                  placeholder="종료 일시를 선택하세요"
                />
              </div>

              <Separator />

              {/* Form Selection */}
              <div className="space-y-2">
                <Label htmlFor="form">
                  사용 {type === "INTERNAL_OPERATION" ? "신청서" : "지원서"}
                  양식 선택{" "}
                  <span className="text-destructive">*</span>
                </Label>
                {formsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={formId} onValueChange={handleFormSelect}>
                    <SelectTrigger id="form">
                      <SelectValue
                        placeholder={`${type === "INTERNAL_OPERATION" ? "신청서" : "지원서"} 양식을 선택하세요`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {forms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  선택한 {type === "INTERNAL_OPERATION" ? "신청서" : "지원서"}
                  양식의 질문 목록이 오른쪽에 표시됩니다.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  id="active"
                  checked={active}
                  onCheckedChange={setActive}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  활성화
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Form Preview */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>
                {type === "INTERNAL_OPERATION" ? "신청서" : "지원서"} 미리보기
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!formId ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">
                    왼쪽에서 {type === "INTERNAL_OPERATION" ? "신청서" : "지원서"}
                    양식을 선택하면 질문 목록이 표시됩니다.
                  </p>
                </div>
              ) : formLoading ? (
                <div className="space-y-4">
                  <div className="pb-3 border-b space-y-1.5">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <div className="flex gap-1.5">
                              <Skeleton className="h-4 w-16" />
                              <Skeleton className="h-4 w-10" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedForm && formSchema ? (
                <div className="space-y-4">
                  {/* Form Title */}
                  <div className="pb-3 border-b">
                    <h3 className="font-semibold text-lg">
                      {selectedForm.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formSchema.questions.length}개 질문
                    </p>
                  </div>

                  {/* Questions List */}
                  {formSchema.questions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">질문이 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formSchema.questions.map((question, index) => (
                        <div
                          key={question.id}
                          className="border rounded-lg p-3 bg-muted/30"
                        >
                          <div className="flex items-start gap-2">
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-xs"
                            >
                              {index + 1}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm whitespace-pre-wrap wrap-break-word">
                                {question.title || "(제목 없음)"}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {QUESTION_TYPE_LABELS[question.type]}
                                </Badge>
                                {question.required && (
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                  >
                                    필수
                                  </Badge>
                                )}
                              </div>
                              {question.options &&
                                question.options.length > 0 && (
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    <span className="font-medium">선택지:</span>{" "}
                                    {question.options.join(", ")}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-destructive">
                  <p className="text-sm">
                    {type === "INTERNAL_OPERATION" ? "신청서" : "지원서"}
                    양식을 불러오는데 실패했습니다.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive text-right mt-4">{error}</p>
      )}
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/manage/recruitments")}
          disabled={isSubmitting}
        >
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
