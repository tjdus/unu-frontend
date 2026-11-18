"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  File,
  LayoutTemplate,
  FileText,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormPreview } from "@/components/custom/form/form-preview";
import { parseSchema, schemaToString } from "@/lib/interfaces/form-builder";
import {} from "@/components/ui/alert-dialog";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import {
  getFormTemplateById,
  deleteFormTemplate,
} from "@/lib/api/form-template";
import { FormTemplateResponse } from "@/lib/interfaces/form";
import { formatDate } from "@/lib/utils/date-utils";

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

export default function ViewFormTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [template, setTemplate] = useState<FormTemplateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  async function loadTemplate() {
    try {
      setIsLoading(true);
      const data = await getFormTemplateById(id);
      setTemplate(data);
    } catch (error: any) {
      console.error("Failed to load template:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteFormTemplate(id);
      router.replace("/manage/forms");
    } catch (error: any) {
      console.error("Failed to delete template:", error);
      setDeleteDialogOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        {/* Back button */}
        <Skeleton className="h-9 w-24" />

        <div className="space-y-4">
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
              <div className="flex items-start gap-3 py-3">
                <Skeleton className="h-4 w-4 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Form Action Card */}
          <Skeleton className="h-20 w-full rounded-lg" />

          {/* 구조 및 미리보기 Card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-96 w-full rounded-md" />
                <Skeleton className="h-96 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
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
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/manage/forms")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{template.title}</h1>
      </div>

      {/* 기본 정보 Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <InfoRow
              icon={<FileText className="h-4 w-4" />}
              label="템플릿 제목"
              value={template.title}
            />
            {template.description && (
              <InfoRow
                icon={<FileText className="h-4 w-4" />}
                label="설명"
                value={
                  <span className="whitespace-pre-wrap font-normal">
                    {template.description}
                  </span>
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schema and Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            템플릿 구조 및 미리보기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">미리보기</h3>
              <ScrollArea className="h-150 w-full">
                <FormPreview schema={parseSchema(template.schema)} />
              </ScrollArea>
            </div>
            {/* Schema JSON */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">스키마 (JSON)</h3>
              <ScrollArea className="h-150 w-full rounded-md border bg-muted/50">
                <pre className="p-4 text-sm font-mono">{schemaToString(template.schema)}</pre>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create a recruitment with these questions */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm mb-1">
                이 템플릿으로 모집 만들기
              </h3>
              <p className="text-xs text-muted-foreground">
                이 템플릿의 질문을 불러온 상태로 새 모집 공고를 만듭니다
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/manage/recruitments/new?templateId=${id}`)}
            >
              <File className="mr-2 h-4 w-4" />
              <span className="text-xs">모집 만들기</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => router.push(`/manage/forms/templates/${id}/edit`)}
        >
          <Pencil className="h-3 w-3" />
          <span className="text-xs">수정</span>
        </Button>
        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="h-3 w-3" />
          <span className="text-xs">삭제</span>
        </Button>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={template.title}
        onConfirm={handleDelete}
      />
    </div>
  );
}
