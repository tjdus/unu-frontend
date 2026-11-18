"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONES } from "@/lib/constants/status-badge-tones";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ApplicationResponse } from "@/lib/interfaces/application";
import type { SchemaValue } from "@/lib/interfaces/form-builder";
import {
  deleteApplication,
  importApplicationLectureRoomSchedule,
  reviewApplication,
} from "@/lib/api/application";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Trash2 } from "lucide-react";
import ApplicationAnswersTable from "./application-answers-table";
import { ApplicationEmail } from "./application-email";
import styles from "./application-table.module.css";

// PASSED/REJECTED 표시 문구는 모집 유형에 따라 달라진다.
// (INTERNAL_OPERATION: 승인/미승인, 그 외: 합격/불합격). enum 값 자체는 그대로.
function passedLabel(useApprovalLabels: boolean) {
  return useApprovalLabels ? "승인" : "합격";
}
function rejectedLabel(useApprovalLabels: boolean) {
  return useApprovalLabels ? "미승인" : "불합격";
}

function getBulkStatusOptions(useApprovalLabels: boolean) {
  return [
    { value: "APPLIED", label: "신청" },
    { value: "IN_PROGRESS", label: "검토중" },
    { value: "WAITING", label: "대기" },
    { value: "HOLD", label: "보류" },
    { value: "PASSED", label: passedLabel(useApprovalLabels) },
    { value: "REJECTED", label: rejectedLabel(useApprovalLabels) },
  ];
}

type StatusFilter = "all" | "PASSED" | "REJECTED" | "WAITING";

interface ApplicationsTableProps {
  applications: ApplicationResponse[];
  questions: SchemaValue;
  enableBulkScheduleImport?: boolean;
  /** true면 PASSED/REJECTED를 "승인/미승인"으로 표시한다(학회 내부 신청/모집용). 기본 false=합격/불합격. */
  useApprovalLabels?: boolean;
  /** 관리자 삭제 성공 시 실제 삭제된 지원서 id들을 부모에 알린다(상단 통계 동기화용). */
  onApplicationsDeleted?: (ids: string[]) => void;
}

// Helper function to determine if status is in waiting group
function isWaitingStatus(status: string): boolean {
  return ["APPLIED", "IN_PROGRESS", "WAITING", "HOLD"].includes(status);
}

// Helper function to get status group for filtering
function getStatusGroup(
  status: string,
): "PASSED" | "REJECTED" | "WAITING" | "CANCELED" {
  if (status === "PASSED") return "PASSED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELED") return "CANCELED";
  return "WAITING";
}

function getStatusBadge(status: string, useApprovalLabels: boolean) {
  switch (status) {
    case "PASSED":
      return (
        <Badge variant="outline" className={STATUS_TONES.positive}>
          {passedLabel(useApprovalLabels)}
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className={STATUS_TONES.negative}>
          {rejectedLabel(useApprovalLabels)}
        </Badge>
      );
    case "APPLIED":
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          신청
        </Badge>
      );
    case "IN_PROGRESS":
      return (
        <Badge variant="outline" className={STATUS_TONES.pending}>
          검토중
        </Badge>
      );
    case "WAITING":
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          대기
        </Badge>
      );
    case "HOLD":
      return (
        <Badge variant="outline" className={STATUS_TONES.pending}>
          보류
        </Badge>
      );
    case "CANCELED":
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          취소
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={STATUS_TONES.neutral}>
          {status}
        </Badge>
      );
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ApplicationsTable({
  applications: initialApplications,
  questions,
  enableBulkScheduleImport = false,
  useApprovalLabels = false,
  onApplicationsDeleted,
}: ApplicationsTableProps) {
  const router = useRouter();
  const bulkStatusOptions = getBulkStatusOptions(useApprovalLabels);
  const [applications, setApplications] = useState(initialApplications);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkScheduleDialogOpen, setBulkScheduleDialogOpen] = useState(false);
  const [bulkScheduleImporting, setBulkScheduleImporting] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Filter applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Status filter
      if (statusFilter !== "all") {
        const group = getStatusGroup(app.status);
        if (statusFilter === "WAITING") {
          if (group !== "WAITING") return false;
        } else if (group !== statusFilter) {
          return false;
        }
      }

      // Search filter (name or student ID)
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          app.name.toLowerCase().includes(searchLower) ||
          app.studentId.includes(search)
        );
      }

      return true;
    }).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [applications, statusFilter, search]);

  // Bulk selection helpers
  const filteredIds = filteredApplications
    .filter((application) => application.status !== "CANCELED")
    .map((application) => application.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  function handleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        filteredIds.forEach((id) => next.add(id));
      } else {
        filteredIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }

  function handleSelectOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
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
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) =>
          reviewApplication(id, bulkTargetStatus),
        ),
      );
      const updatedApplications = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const failedIds = ids.filter(
        (_, index) => results[index].status === "rejected",
      );

      setApplications((prev) =>
        prev.map((app) => {
          const updated = updatedApplications.find((item) => item.id === app.id);
          return updated ?? app;
        }),
      );
      setSelectedIds(new Set(failedIds));

      if (failedIds.length === 0) {
        toast.success(
          bulkTargetStatus === "PASSED" && !useApprovalLabels
            ? `${updatedApplications.length}명을 합격 처리하고 회원가입 초대에 추가했습니다.`
            : `${updatedApplications.length}명의 상태를 변경했습니다.`,
        );
      } else if (updatedApplications.length === 0) {
        toast.error("선택한 지원자의 상태를 변경하지 못했습니다.");
      } else {
        toast.warning(
          `${updatedApplications.length}명은 변경했고, ${failedIds.length}명은 변경하지 못했습니다.`,
        );
      }
    } finally {
      setBulkUpdating(false);
      setBulkStatusDialogOpen(false);
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) => deleteApplication(id)),
      );
      const deletedIds = ids.filter(
        (_, index) => results[index].status === "fulfilled",
      );
      const failedIds = ids.filter(
        (_, index) => results[index].status === "rejected",
      );

      if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds);
        setApplications((prev) =>
          prev.filter((app) => !deletedSet.has(app.id)),
        );
        onApplicationsDeleted?.(deletedIds);
      }
      setSelectedIds(new Set(failedIds));

      if (failedIds.length === 0) {
        toast.success(`${deletedIds.length}명의 지원서를 삭제했습니다.`);
      } else if (deletedIds.length === 0) {
        toast.error("선택한 지원서를 삭제하지 못했습니다.");
      } else {
        toast.warning(
          `${deletedIds.length}명은 삭제했고, ${failedIds.length}명은 삭제하지 못했습니다.`,
        );
      }
    } finally {
      setBulkDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }

  async function handleBulkScheduleImport() {
    setBulkScheduleImporting(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map(importApplicationLectureRoomSchedule),
      );
      const successfulResults = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const failedIds = ids.filter(
        (_, index) => results[index].status === "rejected",
      );
      const createdCount = successfulResults.reduce(
        (sum, result) => sum + result.createdCount,
        0,
      );
      const existingCount = successfulResults.reduce(
        (sum, result) => sum + result.existingCount,
        0,
      );

      setSelectedIds(new Set(failedIds));

      if (failedIds.length === 0) {
        toast.success(
          createdCount > 0
            ? `${successfulResults.length}명의 관리 시간 ${createdCount}개를 반영했습니다.${existingCount > 0 ? ` 기존 ${existingCount}개 블록은 유지했습니다.` : ""}`
            : "선택한 신청자의 관리 시간이 이미 모두 반영되어 있습니다.",
        );
      } else if (successfulResults.length === 0) {
        toast.error("선택한 신청자의 관리 시간을 반영하지 못했습니다.");
      } else {
        toast.warning(
          `${successfulResults.length}명은 반영했고, ${failedIds.length}명은 반영하지 못했습니다.`,
        );
      }
    } finally {
      setBulkScheduleImporting(false);
      setBulkScheduleDialogOpen(false);
    }
  }

  // Calculate counts for tabs (exclude CANCELED from total)
  const allCount = applications.filter(
    (app) => app.status !== "CANCELED",
  ).length;
  const acceptedCount = applications.filter(
    (app) => app.status === "PASSED",
  ).length;
  const rejectedCount = applications.filter(
    (app) => app.status === "REJECTED",
  ).length;
  const waitingCount = applications.filter((app) =>
    isWaitingStatus(app.status),
  ).length;

  const applicantList = (
    <div className="space-y-4">
      {/* Filters / Bulk toolbar */}
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {selectedIds.size > 0 ? (
          <>
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
                {bulkStatusOptions.map((opt) => (
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
            {enableBulkScheduleImport && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setBulkScheduleDialogOpen(true)}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                시간표 일괄 반영
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
          </>
        ) : (
          <Input
            placeholder="이름 또는 학번으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { value: "all", label: "전체", count: allCount },
          { value: "WAITING", label: "대기", count: waitingCount },
          {
            value: "PASSED",
            label: passedLabel(useApprovalLabels),
            count: acceptedCount,
          },
          {
            value: "REJECTED",
            label: rejectedLabel(useApprovalLabels),
            count: rejectedCount,
          },
        ].map(({ value, label, count }) => {
          const active = statusFilter === value;
          return (
            <button
              key={value}
              onClick={() => {
                setStatusFilter(value as StatusFilter);
                setSelectedIds(new Set());
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {label}
              <span
                className={`tabular-nums ${active ? "text-background/70" : "text-muted-foreground/60"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{useApprovalLabels ? "신청자가 없습니다" : "지원자가 없습니다"}</p>
        </div>
      ) : (
        <Table className="min-w-[800px] table-fixed">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[32%]" />
            <col className="w-[9%]" />
            <col className="w-[18%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">
                <div className="flex items-center gap-2">
                  <Checkbox
                    aria-label="표시된 신청서 전체 선택"
                    checked={allFilteredSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                  <span>이름</span>
                </div>
              </TableHead>
              <TableHead scope="col">학번</TableHead>
              <TableHead scope="col">전공</TableHead>
              <TableHead scope="col">이메일</TableHead>
              <TableHead scope="col" className="text-center">상태</TableHead>
              <TableHead scope="col" className="text-center">{useApprovalLabels ? "신청일" : "지원일"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.map((application) => {
              return (
                <TableRow
                  key={application.id}
                  onClick={() => {
                    router.push(`/manage/applications/${application.id}`);
                  }}
                  className="cursor-pointer"
                >
                  <TableCell className="py-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <Checkbox
                        aria-label={`${application.name} 신청서 선택`}
                        checked={selectedIds.has(application.id)}
                        disabled={application.status === "CANCELED"}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(checked) => handleSelectOne(application.id, !!checked)}
                      />
                      <Link
                        href={`/manage/applications/${application.id}`}
                        prefetch={false}
                        onClick={(event) => event.stopPropagation()}
                        className="min-w-0 truncate font-medium hover:underline"
                        title={application.name}
                      >
                        {application.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm py-4 text-muted-foreground">
                    {application.studentId}
                  </TableCell>
                  <TableCell className="text-sm py-4">
                    <div className="max-w-50">
                      <p className="truncate">{application.major}</p>
                      {application.subMajor && (
                        <p className="text-xs text-muted-foreground truncate">
                          {application.subMajor}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm py-3 text-muted-foreground">
                    <ApplicationEmail email={application.email} />
                  </TableCell>
                  <TableCell className="text-center py-4">
                    {getStatusBadge(application.status, useApprovalLabels)}
                  </TableCell>
                  <TableCell className="text-sm py-4 text-muted-foreground text-center">
                    {formatDate(application.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <div className="min-w-0">
      <Tabs defaultValue="list" className="min-w-0 gap-4">
        <TabsList aria-label="신청자 보기" variant="line" className={`h-12 max-w-full ${styles.tabList}`}>
          <TabsTrigger value="list">목록</TabsTrigger>
          <TabsTrigger value="answers">신청 내용 확인</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="min-w-0">{applicantList}</TabsContent>
        <TabsContent value="answers" className="min-w-0">
          <ApplicationAnswersTable
            applications={applications}
            questions={questions}
            useApprovalLabels={useApprovalLabels}
            renderStatus={(status) => getStatusBadge(status, useApprovalLabels)}
          />
        </TabsContent>
      </Tabs>

      {/* Bulk Status Change Dialog */}
      <AlertDialog
        open={bulkStatusDialogOpen}
        onOpenChange={setBulkStatusDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상태 일괄 변경</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 지원자 <strong>{selectedIds.size}명</strong>의 상태를{" "}
              <strong>
                {
                  bulkStatusOptions.find((o) => o.value === bulkTargetStatus)
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

      {/* Bulk Delete Dialog */}
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>선택한 지원자를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 지원자 <strong>{selectedIds.size}명</strong>의 지원서가
              영구적으로 삭제됩니다. 삭제한 지원서는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleBulkDelete();
              }}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkScheduleDialogOpen}
        onOpenChange={setBulkScheduleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>관리 시간을 일괄 반영할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 신청자 <strong>{selectedIds.size}명</strong>의 관리 가능
              시간을 모집 공고에 연결된 분기 시간표에 반영합니다. 이미 등록된
              시간은 중복으로 추가되지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkScheduleImporting}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleBulkScheduleImport();
              }}
              disabled={bulkScheduleImporting}
            >
              {bulkScheduleImporting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              일괄 반영
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
