"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import { FormBuilder } from "@/components/custom/form/form-builder";
import { getFormById, updateForm, deleteForm } from "@/lib/api/form";
import { FormResponse } from "@/lib/interfaces/form";
import { ArrowLeft, X } from "lucide-react";

export default function EditFormPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [form, setForm] = useState<FormResponse | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [schema, setSchema] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadForm();
  }, [id]);

  async function loadForm() {
    try {
      setIsLoading(true);
      const data = await getFormById(id);
      setForm(data);
      setTitle(data.title);
      setDescription(data.description ?? "");
      setStartAt(data.startAt ?? "");
      setEndAt(data.endAt ?? "");
      setSchema(data.schema);
    } catch (error: any) {
      console.error("Failed to load form:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !title.trim() || !schema.trim()) return;

    try {
      setIsSubmitting(true);
      await updateForm(id, {
        title,
        description,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        schema,
      });
      router.push("/manage/forms");
    } catch (error: any) {
      console.error("Failed to update form:", error);
      setIsSubmitting(false);
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
      <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="border-b pb-6 space-y-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 템플릿 */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            {/* 제목 */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-px w-full" />
            {/* 질문 구성 */}
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
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="container mx-auto max-w-7xl py-8 px-4">
        <div className="text-center">
          <p className="text-muted-foreground">폼을 찾을 수 없습니다</p>
          <Button className="mt-4" onClick={() => router.push("/manage/forms")}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">신청서 수정하기</h1>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          신청서 기본 정보와 질문 구성을 수정합니다
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>신청서 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>템플릿</Label>
              <div className="flex items-center gap-2 py-2 px-4 rounded-md border bg-muted/50">
                {form.template ? (
                  <span className="text-xs">{form.template.title}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    템플릿 없음
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                템플릿은 수정할 수 없습니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                제목 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="폼 제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
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
                링크 삽입: <code className="bg-muted px-1 py-0.5 rounded text-xs">[표시텍스트](URL)</code> 예) <code className="bg-muted px-1 py-0.5 rounded text-xs">[스터디계획서](https://...)</code>
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

            <div className="space-y-2">
              <Label>질문 구성</Label>
              <FormBuilder initialSchema={schema} onChange={setSchema} />
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

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={form.title}
        onConfirm={handleDelete}
      />
    </div>
  );
}
