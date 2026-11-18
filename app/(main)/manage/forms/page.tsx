"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAllFormTemplates,
  deleteFormTemplate,
} from "@/lib/api/form-template";
import { FormTemplateResponse } from "@/lib/interfaces/form";
import { formatDate } from "@/lib/utils/date-utils";

export default function AdminFormsPage() {
  const router = useRouter();
  // Templates state
  const [templates, setTemplates] = useState<FormTemplateResponse[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateSearch, setTemplateSearch] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

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

  function confirmDelete(id: string, title: string) {
    setItemToDelete({ id, title });
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!itemToDelete) return;

    try {
      await deleteFormTemplate(itemToDelete.id);
      await loadTemplates();
    } catch (error: any) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  }

  const filteredTemplates = templates.filter((t) =>
    t.title.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Form 템플릿</h1>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          모집 공고를 만들 때 불러와 사용할 Form을 관리합니다
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>템플릿 목록</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/manage/forms/templates/new")}
            >
              <Plus className="h-3 w-3" />
              <span className="text-xs">템플릿 생성</span>
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="템플릿 제목 검색..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {templateSearch
                ? "검색 결과가 없습니다"
                : "아직 템플릿이 없습니다"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제목</TableHead>
                  <TableHead className="text-center">수정일</TableHead>
                  <TableHead className="w-25 text-center">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow
                    key={template.id}
                    onClick={() =>
                      router.push(`/manage/forms/templates/${template.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {template.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm text-center">
                      {formatDate(template.modifiedAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/manage/forms/templates/${template.id}/edit`,
                              );
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            수정
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              confirmDelete(template.id, template.title)
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={itemToDelete?.title || ""}
        onConfirm={handleDelete}
      />
    </div>
  );
}
