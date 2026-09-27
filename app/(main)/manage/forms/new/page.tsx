"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FormBuilder } from "@/components/custom/form/form-builder";
import { createForm } from "@/lib/api/form";
import { getAllFormTemplates } from "@/lib/api/form-template";
import { FormTemplateResponse } from "@/lib/interfaces/form";
import { parseSchema, serializeSchema } from "@/lib/interfaces/form-builder";

import { Suspense } from "react";

function NewFormPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get("templateId");
  const [templates, setTemplates] = useState<FormTemplateResponse[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templateIdFromQuery || "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [schema, setSchema] = useState(
    serializeSchema({ version: 1, questions: [] }),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; schema?: string }>({});
  const schemaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (templateIdFromQuery && templates.length > 0) {
      setSelectedTemplateId(templateIdFromQuery);
      const template = templates.find((t) => t.id === templateIdFromQuery);
      if (template) {
        setSchema(template.schema);
        if (template.title) setTitle(template.title);
        if (template.description) setDescription(template.description);
      }
    }
  }, [templateIdFromQuery, templates]);

  async function loadTemplates() {
    try {
      setTemplatesLoading(true);
      const data = await getAllFormTemplates();
      setTemplates(data);
    } catch (error: any) {
      console.error("Failed to load templates:", error);
    } finally {
      setTemplatesLoading(false);
    }
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSchema(template.schema);
      if (template.title) setTitle(template.title);
      if (template.description) setDescription(template.description);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: { title?: string; schema?: string } = {};
    if (!title.trim()) newErrors.title = "제목을 입력해주세요.";
    if (parseSchema(schema).questions.length === 0)
      newErrors.schema = "질문을 1개 이상 추가해주세요.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.schema) {
        schemaRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }

    try {
      setIsSubmitting(true);
      await createForm({
        templateId: selectedTemplateId,
        title,
        description,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        schema,
      });
      router.push("/manage/forms");
    } catch (error: any) {
      console.error("Failed to create form:", error);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">신청서 생성하기</h1>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          템플릿을 선택해 새 신청서를 생성합니다
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>신청서 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template">템플릿 선택</Label>
              {templatesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedTemplateId}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger id="template" className="text-xs">
                    <SelectValue placeholder="템플릿을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem
                        key={template.id}
                        value={String(template.id)}
                        className="text-xs"
                      >
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                템플릿을 선택하면 질문이 자동으로 채워집니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                제목 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="신청서 제목을 입력하세요"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title)
                    setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                aria-invalid={!!errors.title}
                className={
                  errors.title
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                placeholder="신청서 설명을 입력하세요"
                className="min-h-24 resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                링크 삽입:{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  [표시텍스트](URL)
                </code>{" "}
                예){" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  [스터디계획서](https://...)
                </code>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>신청 시작일시</Label>
                <DateTimePicker
                  value={startAt}
                  onChange={setStartAt}
                  placeholder="시작일시를 선택하세요"
                  clearable
                />
              </div>
              <div className="space-y-2">
                <Label>신청 마감일시</Label>
                <DateTimePicker
                  value={endAt}
                  onChange={setEndAt}
                  placeholder="마감일시를 선택하세요"
                  clearable
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2" ref={schemaRef}>
              <Label>질문 구성</Label>
              <FormBuilder
                initialSchema={schema}
                onChange={(s) => {
                  setSchema(s);
                  if (errors.schema && parseSchema(s).questions.length > 0)
                    setErrors((prev) => ({ ...prev, schema: undefined }));
                }}
              />
              {errors.schema && (
                <p className="text-sm text-destructive">{errors.schema}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/manage/forms")}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewFormPage() {
  return (
    <Suspense>
      <NewFormPageInner />
    </Suspense>
  );
}
