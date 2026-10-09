"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Users,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONES } from "@/lib/constants/status-badge-tones";
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
import { Skeleton } from "@/components/ui/skeleton";
import { removeUsers, searchUsers } from "@/lib/api/user";
import { getAllQuarters } from "@/lib/api/quarter";
import { UserResponseDto } from "@/lib/interfaces/auth";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import { getRoleBadgeVariant, getRoleLabel } from "@/lib/utils/role-utils";
import { useAuth } from "@/lib/contexts/AuthContext";
import { MemberCreateDialog } from "@/components/custom/member/member-create-dialog";
import { MemberActivityTab } from "@/components/custom/member/member-activity-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RoleFilter = "ALL" | "MEMBER" | "MANAGER" | "ADMIN" | "LECTURE_ROOM_MANAGER" | "BLOG_MANAGER" | "ALUMNI";
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

const MEMBERS_PER_PAGE = 10;
const SEASON_ORDER: Record<string, number> = {
  WINTER: 1,
  SPRING: 2,
  SUMMER: 3,
  FALL: 4,
};

export default function MembersManagementPage() {
  const router = useRouter();
  const { hasRole, userId } = useAuth();
  const isAdmin = hasRole("ADMIN");

  const [members, setMembers] = useState<UserResponseDto[]>([]);
  const [totalMemberCount, setTotalMemberCount] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [quarters, setQuarters] = useState<QuarterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");
  const [joinedQuarterFilter, setJoinedQuarterFilter] = useState("ALL");
  const [nameSearch, setNameSearch] = useState("");
  const [studentIdSearch, setStudentIdSearch] = useState("");

  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedStudentId, setDebouncedStudentId] = useState("");

  // Load quarters on mount
  useEffect(() => {
    async function loadQuarters() {
      try {
        const quartersData = await getAllQuarters();
        setQuarters(quartersData);
      } catch (err) {
        console.error("Failed to load quarters:", err);
      }
    }
    loadQuarters();
  }, []);

  useEffect(() => {
    let cancelled = false;

    searchUsers({})
      .then((results) => {
        if (!cancelled) setTotalMemberCount(results.length);
      })
      .catch((err) => {
        console.error("Failed to load total member count:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // Debounce text inputs (500ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameSearch), 500);
    return () => clearTimeout(t);
  }, [nameSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStudentId(studentIdSearch), 500);
    return () => clearTimeout(t);
  }, [studentIdSearch]);

  // Auto-search when any filter changes
  useEffect(() => {
    async function search() {
      setLoading(true);
      try {
        const params: {
          role?: string;
          isCurrentQuarterActive?: boolean;
          joinedQuarter?: string;
          name?: string;
          studentId?: string;
        } = {};
        if (roleFilter !== "ALL") params.role = roleFilter;
        if (activeFilter === "ACTIVE") params.isCurrentQuarterActive = true;
        if (activeFilter === "INACTIVE") params.isCurrentQuarterActive = false;
        if (joinedQuarterFilter !== "ALL")
          params.joinedQuarter = joinedQuarterFilter;
        if (debouncedName.trim()) params.name = debouncedName.trim();
        if (debouncedStudentId.trim())
          params.studentId = debouncedStudentId.trim();
        const results = await searchUsers(params);

        results.sort((a, b) => {
          const qA = a.joinedQuarter?.name;
          const qB = b.joinedQuarter?.name;

          if (!qA && !qB) return 0;
          if (!qA) return 1;
          if (!qB) return -1;

          const [yearA, seasonA] = qA.split(" ");
          const [yearB, seasonB] = qB.split(" ");

          if (yearA !== yearB) {
            return Number(yearB) - Number(yearA);
          }
          const orderA = SEASON_ORDER[seasonA.toUpperCase()] || 0;
          const orderB = SEASON_ORDER[seasonB.toUpperCase()] || 0;
          return orderB - orderA;
        });

        setMembers(results);
        setSelectedMemberIds([]);
        setCurrentPage(1);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }
    search();
  }, [
    roleFilter,
    activeFilter,
    joinedQuarterFilter,
    debouncedName,
    debouncedStudentId,
    refreshToken,
  ]);

  const hasFilters =
    roleFilter !== "ALL" ||
    activeFilter !== "ALL" ||
    joinedQuarterFilter !== "ALL" ||
    nameSearch.trim() !== "" ||
    studentIdSearch.trim() !== "";

  const totalPages = Math.max(
    1,
    Math.ceil(members.length / MEMBERS_PER_PAGE),
  );
  const paginatedMembers = members.slice(
    (currentPage - 1) * MEMBERS_PER_PAGE,
    currentPage * MEMBERS_PER_PAGE,
  );
  const selectablePageMembers = paginatedMembers.filter(
    (member) => member.id !== userId,
  );
  const selectedMemberIdSet = new Set(selectedMemberIds);
  const selectedMembers = members.filter((member) =>
    selectedMemberIdSet.has(member.id),
  );
  const allPageMembersSelected =
    selectablePageMembers.length > 0 &&
    selectablePageMembers.every((member) =>
      selectedMemberIdSet.has(member.id),
    );
  const somePageMembersSelected = selectablePageMembers.some((member) =>
    selectedMemberIdSet.has(member.id),
  );

  function togglePageSelection(checked: boolean) {
    const pageIds = selectablePageMembers.map((member) => member.id);
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return [...next];
    });
  }

  function toggleMemberSelection(memberId: string, checked: boolean) {
    setSelectedMemberIds((current) =>
      checked
        ? [...new Set([...current, memberId])]
        : current.filter((id) => id !== memberId),
    );
  }

  async function handleRemoveMembers() {
    if (selectedMemberIds.length === 0) return;
    try {
      setRemoving(true);
      const removedCount = selectedMemberIds.length;
      await removeUsers(selectedMemberIds);
      setSelectedMemberIds([]);
      setRemoveDialogOpen(false);
      setRefreshToken((value) => value + 1);
      toast.success(`${removedCount}명의 학회원을 삭제했습니다.`);
    } catch (error) {
      const message = (error as { response?: { data?: unknown } })?.response
        ?.data;
      toast.error(
        typeof message === "string" && message.trim()
          ? message
          : "학회원을 삭제하지 못했습니다.",
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">학회원 관리</h1>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            학회원 정보를 조회하고 관리합니다
          </p>
        </div>
        {isAdmin && (
          <MemberCreateDialog
            onCreated={() => setRefreshToken((v) => v + 1)}
          />
        )}
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">학회원 목록</TabsTrigger>
          <TabsTrigger value="activity">퇴출 관리</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>학회원 목록</CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {isAdmin && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={selectedMemberIds.length === 0}
                  onClick={() => setRemoveDialogOpen(true)}
                >
                  <Trash2 className="size-4" />
                  선택 삭제
                  {selectedMemberIds.length > 0 &&
                    ` (${selectedMemberIds.length})`}
                </Button>
              )}
              <div
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
                aria-live="polite"
              >
                <Users className="size-4" aria-hidden="true" />
                <span>총 {totalMemberCount ?? "-"}명</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 mt-4">
            {/* Row 1: Search inputs */}
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="이름 검색..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="학번 검색..."
                  value={studentIdSearch}
                  onChange={(e) => setStudentIdSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={roleFilter}
                onValueChange={(value) => setRoleFilter(value as RoleFilter)}
              >
                <SelectTrigger className="w-full text-xs xl:w-35">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    전체 역할
                  </SelectItem>
                  <SelectItem value="MEMBER" className="text-xs">
                    학회원
                  </SelectItem>
                  <SelectItem value="MANAGER" className="text-xs">
                    운영자
                  </SelectItem>
                  <SelectItem value="ADMIN" className="text-xs">
                    관리자
                  </SelectItem>
                  <SelectItem value="LECTURE_ROOM_MANAGER" className="text-xs">
                    학회실 관리자
                  </SelectItem>
                  <SelectItem value="BLOG_MANAGER" className="text-xs">
                    블로그 에디터
                  </SelectItem>
                  <SelectItem value="ALUMNI" className="text-xs">
                    Alumni
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={activeFilter}
                onValueChange={(value) =>
                  setActiveFilter(value as ActiveFilter)
                }
              >
                <SelectTrigger className="w-full text-xs xl:w-35">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    전체 상태
                  </SelectItem>
                  <SelectItem value="ACTIVE" className="text-xs">
                    활동 중
                  </SelectItem>
                  <SelectItem value="INACTIVE" className="text-xs">
                    활동 안 함
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={joinedQuarterFilter}
                onValueChange={setJoinedQuarterFilter}
              >
                <SelectTrigger className="w-full text-xs xl:w-35">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    전체 가입 분기
                  </SelectItem>
                  {quarters.map((quarter) => (
                    <SelectItem
                      key={quarter.id}
                      value={quarter.name}
                      className="text-xs"
                    >
                      {quarter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {hasFilters
                ? "검색 결과가 없습니다"
                : "아직 등록된 학회원이 없습니다"}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-10 pr-0">
                        <Checkbox
                          checked={
                            allPageMembersSelected
                              ? true
                              : somePageMembersSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) =>
                            togglePageSelection(checked === true)
                          }
                          aria-label="현재 페이지 학회원 전체 선택"
                        />
                      </TableHead>
                    )}
                    <TableHead>이름</TableHead>
                    <TableHead className="hidden text-center lg:table-cell">
                      학번
                    </TableHead>
                    <TableHead className="hidden text-center xl:table-cell">
                      아이디
                    </TableHead>
                    <TableHead className="hidden text-center lg:table-cell">
                      역할
                    </TableHead>
                    <TableHead className="hidden text-center lg:table-cell">
                      상태
                    </TableHead>
                    <TableHead className="hidden text-center xl:table-cell">
                      가입 분기
                    </TableHead>
                    <TableHead className="hidden text-center xl:table-cell">
                      이메일
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMembers.map((member) => (
                    <TableRow
                      key={member.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/manage/members/${member.id}`)
                      }
                    >
                      {isAdmin && (
                        <TableCell
                          className="w-10 pr-0"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedMemberIdSet.has(member.id)}
                            disabled={member.id === userId}
                            onCheckedChange={(checked) =>
                              toggleMemberSelection(member.id, checked === true)
                            }
                            aria-label={`${member.name || member.username} 선택`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {member.name || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {member.studentId || "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">
                        {member.username}
                      </TableCell>
                      <TableCell className="hidden whitespace-normal pt-4 pb-4 lg:table-cell">
                        {member.userRoles?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {member.userRoles.map((role) => (
                              <Badge
                                key={role.id}
                                variant={getRoleBadgeVariant(role.role.name)}
                              >
                                {getRoleLabel(role.role.name)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline">없음</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {member.isCurrentQuarterActive ? (
                          <Badge
                            variant="outline"
                            className={`gap-1 ${STATUS_TONES.positive}`}
                          >
                            <UserCheck className="h-3 w-3" />
                            활동 중
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`gap-1 ${STATUS_TONES.neutral}`}
                          >
                            <UserX className="h-3 w-3" />
                            활동 안 함
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">
                        {member.joinedQuarter?.name || "—"}
                      </TableCell>
                      <TableCell className="hidden whitespace-normal break-all text-sm text-muted-foreground xl:table-cell">
                        {member.email}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-5 flex items-center justify-center gap-3 border-t pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="이전 페이지"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="min-w-16 text-center text-sm font-medium text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="다음 페이지"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="activity">
          <MemberActivityTab quarters={quarters} refreshToken={refreshToken} onRemoved={() => setRefreshToken((value) => value + 1)} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedMemberIds.length}명의 학회원을 삭제하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 leading-6">
              <span className="block">삭제할 학회원을 확인해주세요.</span>
              <span className="block max-h-40 overflow-y-auto rounded-md border bg-muted/40 px-4 py-2.5 text-foreground">
                {selectedMembers.map((member) => (
                  <span
                    key={member.id}
                    className="flex items-center justify-between gap-4 border-b py-1.5 last:border-b-0"
                  >
                    <span className="font-medium">
                      {member.name || member.username}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {member.studentId}
                    </span>
                  </span>
                ))}
              </span>
              <span className="block">
                삭제된 계정은 학회원 목록에서 제외되고 더 이상 로그인할 수
                없습니다. 기존 활동과 신청 기록은 유지됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveMembers();
              }}
            >
              {removing ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
