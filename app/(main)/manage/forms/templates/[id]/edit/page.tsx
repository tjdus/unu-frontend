"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import { FormBuilder } from "@/components/custom/form/form-builder";
import {
  getFormTemplateById,
  updateFormTemplate,
  deleteFormTemplate,
} from "@/lib/api/form-template";
import { FormTemplateResponse } from "@/lib/interfaces/form";
import { schemaToString } from "@/lib/interfaces/form-builder";

export default function EditFormTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [template, setTemplate] = useState<FormTemplateResponse | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [schema, setSchema] = useState("");
  const [initialTitle, setInitialTitle] = useState("");
  const [initialDescription, setInitialDescription] = useState("");
  const [initialSchema, setInitialSchema] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const hasUnsavedChanges =
    title !== initialTitle ||
    description !== initialDescription ||
    schema !== initialSchema;

  useEffect(() => {
    loadTemplate();
  }, [id]);

  async function loadTemplate() {
    try {
      setIsLoading(true);
      const data = await getFormTemplateById(id);
      setTemplate(data);
      setTitle(data.title);
      setDescription(data.description ?? "");
      setSchema(schemaToString(data.schema));
      setInitialTitle(data.title);
      setInitialDescription(data.description ?? "");
      setInitialSchema(schemaToString(data.schema));
      setLastSaved(new Date(data.modifiedAt));
    } catch (error: any) {
      console.error("Failed to load template:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !schema.trim()) return;

    try {
      setIsSubmitting(true);
      await updateFormTemplate(id, { title, description, schema });
      setInitialTitle(title);
      setInitialDescription(description);
      setInitialSchema(schema);
      setLastSaved(new Date());
      router.push("/manage/forms");
    } catch (error: any) {
      console.error("Failed to update template:", error);
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteFormTemplate(id);
      router.push("/manage/forms");
    } catch (error: any) {
      console.error("Failed to delete template:", error);
      setDeleteDialogOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="border-b pb-6 space-y-3">
          <Skeleton className="h-9 w-24" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-4 w-full max-w-72" />
            </div>
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-96 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Skeleton className="h-9 w-12" />
          <div className="flex gap-3">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-10 w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <div className="text-center">
          <p className="text-muted-foreground">템플릿을 찾을 수 없습니다</p>
          <Button className="mt-4" onClick={() => router.push("/manage/forms")}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">템플릿 수정하기</h1>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            템플릿 기본 정보를 수정합니다
          </p>
        </div>
        <div className="text-sm text-right">
          {hasUnsavedChanges ? (
            <span className="text-amber-600 font-medium">
              저장되지 않은 변경 사항 있음
            </span>
          ) : lastSaved ? (
            <span className="text-muted-foreground">
              {(() => {
                const diffMs = new Date().getTime() - lastSaved.getTime();
                const diffMin = Math.floor(diffMs / 60000);
                const diffHour = Math.floor(diffMs / 3600000);
                const diffDay = Math.floor(diffMs / 86400000);
                if (diffMs < 60000) return "방금 저장됨";
                if (diffMin < 60) return `${diffMin}분 전 저장됨`;
                if (diffHour < 24) return `${diffHour}시간 전 저장됨`;
                return `${diffDay}일 전 저장됨`;
              })()}
            </span>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>템플릿 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                placeholder="템플릿 제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                placeholder="템플릿 설명을 입력하세요 (선택)"
                className="min-h-24 resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>질문 구성</Label>
              <FormBuilder initialSchema={schema} onChange={setSchema} />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <div className="flex gap-3">
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
        </div>
      </form>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={template.title || ""}
        onConfirm={handleDelete}
      />
    </div>
  );
}
