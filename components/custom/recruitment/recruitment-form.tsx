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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createRecruitment,
  getAllRecruitments,
  updateRecruitment,
} from "@/lib/api/recruitment";
import { getAllFormTemplates } from "@/lib/api/form-template";
import { getAllQuarters } from "@/lib/api/quarter";
import { FormTemplateResponse } from "@/lib/interfaces/form";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import {
  RecruitmentResponse,
  RecruitmentType,
} from "@/lib/interfaces/recruitment";
import {
  parseSchema,
  schemaToString,
  serializeSchema,
} from "@/lib/interfaces/form-builder";
import { FormBuilder } from "@/components/custom/form/form-builder";
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
  const [active, setActive] = useState(initialData?.active ?? true);
  const [type, setType] = useState<RecruitmentType>(
    initialData?.type || "NEW_MEMBER",
  );

  // Data loading
  const [quarters, setQuarters] = useState<QuarterResponse[]>([]);
  const [quartersLoading, setQuartersLoading] = useState(true);

  // Questions: owned by the recruitment. `loadedQuestions` seeds the builder (initial value or
  // a copy loaded from a template / past recruitment); `questionsJson` is what the builder holds.
  const [loadedQuestions, setLoadedQuestions] = useState(() =>
    initialData
      ? schemaToString(initialData.questions)
      : serializeSchema({ version: 1, questions: [] }),
  );
  const [questionsJson, setQuestionsJson] = useState(loadedQuestions);
  const [templates, setTemplates] = useState<FormTemplateResponse[]>([]);
  const [pastRecruitments, setPastRecruitments] = useState<RecruitmentResponse[]>([]);
  const [sourceKey, setSourceKey] = useState("");

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuarters();
    // Sources for "불러오기"; failures only leave the menu shorter.
    getAllFormTemplates()
      .then((list) => {
        setTemplates(list);
        // "이 템플릿으로 모집 만들기" opens /manage/recruitments/new?templateId=…
        const templateId = new URLSearchParams(window.location.search).get("templateId");
        const template = mode === "create" && list.find((item) => item.id === templateId);
        if (template) {
          setLoadedQuestions(schemaToString(template.schema));
          setSourceKey(`template:${template.id}`);
        }
      })
      .catch(() => undefined);
    getAllRecruitments()
      .then((list) => setPastRecruitments(list.filter((item) => item.id !== initialData?.id)))
      .catch(() => undefined);
  }, [initialData?.id, mode]);

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

  function handleLoadQuestions(key: string) {
    const [kind, id] = key.split(":");
    const source =
      kind === "template"
        ? templates.find((template) => template.id === id)?.schema
        : pastRecruitments.find((recruitment) => recruitment.id === id)?.questions;
    if (!source) return;
    const hasQuestions = parseSchema(questionsJson).questions.length > 0;
    if (hasQuestions && !window.confirm("지금 작성한 질문을 불러온 질문으로 바꿀까요?")) return;
    // A copy: later edits here don't touch the template or the other recruitment.
    setLoadedQuestions(schemaToString(source));
    setSourceKey(key);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !quarterId || !startAt || !endAt) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    const questions = parseSchema(questionsJson);
    if (questions.questions.some((question) => !question.title.trim())) {
      setError("질문 제목을 모두 입력해주세요.");
      return;
    }
    if (
      questions.questions.some(
        (question) =>
          (question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") &&
          !question.options?.some((option) => option.trim()),
      )
    ) {
      setError("선택형 질문에는 보기를 1개 이상 입력해주세요.");
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
        questions,
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
                <div className="relative h-36">
                  <Textarea
                    id="description"
                    placeholder="모집에 대한 설명을 입력하세요"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    // Opaque and elevated while expanded: the app's M3 field styles make inputs
                    // transparent and shadowless, which let the fields underneath show through.
                    className="absolute left-0 top-0 z-30 min-h-36 w-full resize-none bg-background! text-sm leading-relaxed transition-[width,min-height,box-shadow,transform] duration-200 focus:min-h-64 focus:shadow-[0_18px_45px_rgb(15_23_42_/_0.18)]! focus-visible:ring-0 focus-visible:ring-offset-0 lg:focus:min-h-96 lg:focus:w-[calc(200%+1.5rem)] lg:focus:-translate-x-8"
                  />
                </div>
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

        {/* Right: Questions (owned by this recruitment) */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle>
                {type === "INTERNAL_OPERATION" ? "신청서" : "지원서"} 질문
              </CardTitle>
              <Select value={sourceKey} onValueChange={handleLoadQuestions}>
                <SelectTrigger className="h-9 w-auto min-w-40" aria-label="질문 불러오기">
                  <SelectValue placeholder="불러오기" />
                </SelectTrigger>
                <SelectContent align="end">
                  {templates.length === 0 && pastRecruitments.length === 0 && (
                    <SelectItem value="none" disabled>
                      불러올 질문이 없습니다
                    </SelectItem>
                  )}
                  {templates.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>템플릿</SelectLabel>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={`template:${template.id}`}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {pastRecruitments.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>지난 모집</SelectLabel>
                      {pastRecruitments.map((recruitment) => (
                        <SelectItem key={recruitment.id} value={`recruitment:${recruitment.id}`}>
                          {recruitment.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                템플릿이나 지난 모집에서 질문을 복사해 올 수 있습니다. 복사한 뒤에 고쳐도
                원본에는 영향이 없습니다.
              </p>
              <FormBuilder initialSchema={loadedQuestions} onChange={setQuestionsJson} layout="stacked" />
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
