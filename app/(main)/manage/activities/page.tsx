"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Pencil,
  Trash2,
  MoreVertical,
  Eye,
  SquarePlus,
  Plus,
  ChevronLeft,
  ChevronRight,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import {
  searchActivities,
  deleteActivity,
  updateActivityStatus,
} from "@/lib/api/activity";
import { getAllActivityTypes } from "@/lib/api/activity-type";
import { getAllQuarters } from "@/lib/api/quarter";
import {
  ActivityResponse,
  ActivityTypeResponse,
} from "@/lib/interfaces/activity";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import { ActivityStatusBadge } from "@/components/custom/activity/activity-status-badge";
import { activityDisplayStatus } from "@/lib/utils/activity-recruitment";
import { ActivityTypeBadge } from "@/components/custom/activity/activity-type-badge";
import { formatDate } from "@/lib/utils/date-utils";
import { toast } from "sonner";
import { ActivityManagementNav } from "@/components/custom/activity/activity-management-nav";

const STATUS_OPTIONS = [
  { value: "CREATED", label: "준비 중" },
  { value: "ONGOING", label: "진행 중" },
  { value: "COMPLETED", label: "종료" },
];

const ACTIVITIES_PER_PAGE = 10;

export default function ActivitiesManagementPage() {
  const router = useRouter();

  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeResponse[]>(
    [],
  );
  const [quarters, setQuarters] = useState<QuarterResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState("ALL");
  const [quarterFilter, setQuarterFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [activityTypeFilter, quarterFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      setLoading(true);
      const [activitiesData, typesData, quartersData] = await Promise.all([
        searchActivities({ includeUnlisted: true }),
        getAllActivityTypes(),
        getAllQuarters(),
      ]);
      setActivities(activitiesData);
      setCurrentPage(1);
      setActivityTypes(typesData);
      setQuarters(quartersData);
    } catch (error: any) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    try {
      setLoading(true);
      const params: {
        title?: string;
        status?: string;
        activityTypeId?: string;
        quarterId?: string;
      } = {};
      if (search.trim()) params.title = search.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (activityTypeFilter !== "ALL")
        params.activityTypeId = activityTypeFilter;
      if (quarterFilter !== "ALL") params.quarterId = quarterFilter;
      const results = await searchActivities({ ...params, includeUnlisted: true });
      setActivities(results);
      setCurrentPage(1);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }

  const sortedActivities = [...activities].sort((a, b) =>
    (b.startDate ?? "").localeCompare(a.startDate ?? ""),
  );

  // Bulk selection helpers
  const totalPages = Math.max(
    1,
    Math.ceil(sortedActivities.length / ACTIVITIES_PER_PAGE),
  );
  const paginatedActivities = sortedActivities.slice(
    (currentPage - 1) * ACTIVITIES_PER_PAGE,
    currentPage * ACTIVITIES_PER_PAGE,
  );
  const selectedActivities = sortedActivities.filter((a) =>
    selectedIds.has(a.id),
  );
  const allSelected =
    paginatedActivities.length > 0 &&
    paginatedActivities.every((a) => selectedIds.has(a.id));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  function handleSelectAll(checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      paginatedActivities.forEach((activity) => {
        if (checked) next.add(activity.id);
        else next.delete(activity.id);
      });
      return next;
    });
  }

  function handleSelectOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function openBulkStatusDialog(targetStatus: string) {
    setBulkTargetStatus(targetStatus);
    setBulkStatusDialogOpen(true);
  }

  async function handleBulkStatusChange() {
    setBulkUpdating(true);
    try {
      await Promise.all(
        selectedActivities.map((a) =>
          updateActivityStatus(a.id, bulkTargetStatus),
        ),
      );
      setActivities((prev) =>
        prev.map((a) =>
          selectedIds.has(a.id) ? { ...a, status: bulkTargetStatus } : a,
        ),
      );
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Bulk status update failed:", error);
    } finally {
      setBulkUpdating(false);
      setBulkStatusDialogOpen(false);
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = selectedActivities.map((activity) => activity.id);
    const results = await Promise.allSettled(
      ids.map((id) => deleteActivity(id)),
    );

    const deletedIds = new Set(
      ids.filter((_, index) => results[index].status === "fulfilled"),
    );
    const failureCount = ids.length - deletedIds.size;

    setActivities((prev) => prev.filter((a) => !deletedIds.has(a.id)));
    setSelectedIds(new Set());
    setBulkDeleting(false);
    setBulkDeleteDialogOpen(false);

    if (failureCount === 0) {
      toast.success(`${deletedIds.size}개 활동을 삭제했습니다.`);
    } else {
      toast.error(`${deletedIds.size}개 삭제, ${failureCount}개 실패`);
    }
  }

  function confirmDelete(id: string, title: string) {
    setItemToDelete({ id, title });
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!itemToDelete) return;
    try {
      await deleteActivity(itemToDelete.id);
      setActivities((prev) => prev.filter((a) => a.id !== itemToDelete.id));
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(itemToDelete.id);
        return next;
      });
    } catch (error: any) {
      console.error("Delete failed:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  }

  const hasFilters =
    activityTypeFilter !== "ALL" ||
    quarterFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    search.trim() !== "";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">활동 관리</h1>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          학회 활동을 관리합니다
        </p>
      </div>

      <ActivityManagementNav />

      <Card>
        <CardHeader>
          {/* Title + New Button */}
          <div className="flex items-center justify-between">
            <CardTitle>활동 목록</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/manage/activities/new")}
            >
              <Plus className="h-3 w-3" />
              <span className="text-xs">활동 생성</span>
            </Button>
          </div>

          {/* Filters / Bulk toolbar toggle */}
          <div className="mt-4">
            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-3 h-9">
                <span className="text-xs text-muted-foreground font-medium">
                  {selectedIds.size}개 선택됨
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      상태 변경
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        className="text-xs"
                        onClick={() => openBulkStatusDialog(opt.value)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkDeleting}
                >
                  삭제
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 ml-auto"
                  onClick={() => setSelectedIds(new Set())}
                >
                  선택 해제
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 xl:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="활동명 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9"
                  />
                </div>

                <Select
                  value={activityTypeFilter}
                  onValueChange={setActivityTypeFilter}
                >
                  <SelectTrigger className="w-full text-xs xl:w-35">
                    <SelectValue placeholder="전체 유형" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">
                      전체 유형
                    </SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem
                        key={type.id}
                        value={type.id}
                        className="text-xs"
                      >
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                  <SelectTrigger className="w-full text-xs xl:w-35">
                    <SelectValue placeholder="전체 분기" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">
                      전체 분기
                    </SelectItem>
                    {quarters.map((quarter) => (
                      <SelectItem
                        key={quarter.id}
                        value={quarter.id}
                        className="text-xs"
                      >
                        {quarter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full text-xs xl:w-35">
                    <SelectValue placeholder="전체 상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">
                      전체 상태
                    </SelectItem>
                    <SelectItem value="CREATED" className="text-xs">
                      준비 중
                    </SelectItem>
                    <SelectItem value="OPEN" className="text-xs">
                      모집 중
                    </SelectItem>
                    <SelectItem value="ONGOING" className="text-xs">
                      진행 중
                    </SelectItem>
                    <SelectItem value="COMPLETED" className="text-xs">
                      종료
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {hasFilters
                ? "검색 결과가 없습니다"
                : "아직 등록된 활동이 없습니다"}
            </div>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          handleSelectAll(!!checked)
                        }
                      />
                    </TableHead>
                    <TableHead>활동명</TableHead>
                    <TableHead className="hidden text-center lg:table-cell">
                      유형
                    </TableHead>
                    <TableHead className="hidden text-center xl:table-cell">
                      분기
                    </TableHead>
                    <TableHead className="hidden text-center xl:table-cell">
                      기간
                    </TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="hidden text-center xl:table-cell">
                      담당자
                    </TableHead>
                    <TableHead className="w-16">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActivities.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/manage/activities/${activity.id}`)
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(activity.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(activity.id, !!checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="whitespace-normal break-words font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{activity.title}</span>
                          {activity.listed === false && (
                            <span className="text-xs font-normal text-muted-foreground">개인</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-center lg:table-cell">
                        <ActivityTypeBadge
                          activityType={activity.activityType}
                        />
                      </TableCell>
                      <TableCell className="hidden text-center text-sm text-muted-foreground xl:table-cell">
                        {activity.quarter?.name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-center text-sm text-muted-foreground xl:table-cell">
                        {formatDate(activity.startDate)} -{" "}
                        {formatDate(activity.endDate)}
                      </TableCell>
                      <TableCell className="text-center">
                        <ActivityStatusBadge status={activityDisplayStatus(activity)} />
                      </TableCell>
                      <TableCell className="hidden text-center text-sm text-muted-foreground xl:table-cell">
                        {activity.assignee.name}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/manage/activities/${activity.id}/edit`,
                                );
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(activity.id, activity.title);
                              }}
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

          {!loading && activities.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <p className="text-xs text-muted-foreground">
                총 {activities.length}개 활동
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="이전 페이지"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-14 text-center text-xs text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="다음 페이지"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Status Change Dialog */}
      <AlertDialog
        open={bulkStatusDialogOpen}
        onOpenChange={setBulkStatusDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상태 일괄 변경</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 활동 <strong>{selectedIds.size}개</strong>를{" "}
              <strong>
                {
                  STATUS_OPTIONS.find((o) => o.value === bulkTargetStatus)
                    ?.label
                }
              </strong>
              (으)로 변경합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdating}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkStatusChange}
              disabled={bulkUpdating}
            >
              {bulkUpdating ? "변경 중..." : "변경"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={(open) => !bulkDeleting && setBulkDeleteDialogOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택한 활동을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedIds.size}개</strong> 활동이 삭제됩니다. 참여자,
              일정, 출석 기록과 활동 공지도 함께 삭제되며 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleBulkDelete();
              }}
            >
              {bulkDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={itemToDelete?.title || ""}
        onConfirm={handleDelete}
      />
    </div>
  );
}
