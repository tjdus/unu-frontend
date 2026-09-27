"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DeleteConfirmDialog } from "@/components/custom/common/delete-confirm-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getActivityById,
  deleteActivity,
  updateActivityStatus,
} from "@/lib/api/activity";
import { getLectureMaterialsByActivity } from "@/lib/api/lecture-material";
import {
  getMyParticipantByActivityId,
  createMyParticipantByActivityId,
  deleteActivityParticipant,
  getActivityMemberSummaries,
  getActivityCapacity,
} from "@/lib/api/activity-participant";
import { ActivityResponse } from "@/lib/interfaces/activity";
import { LectureMaterial } from "@/lib/interfaces/lecture-material";
import {
  ActivityJoinRequest,
  ActivityParticipantResponse,
  ActivityParticipantSummary,
  ActivityCapacityResponse,
} from "@/lib/interfaces/activity-participant";
import {
  Calendar,
  CalendarRange,
  User,
  ClipboardList,
  BadgeCheck,
  BadgeX,
  Clock,
  Settings,
  Pencil,
  Trash2,
  ArrowLeft,
  ExternalLink,
  Users,
  AlertCircle,
  Landmark,
  RotateCcw,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { CourseTimeReservationCard } from "@/components/custom/activity/course-time-reservation";
import { CourseSessionReportCard } from "@/components/custom/activity/course-session-report";
import { WeeklyMaterials } from "@/components/custom/activity/weekly-materials";
import { ActivityNotices } from "@/components/custom/activity/activity-notices";
import { getActivityNotices } from "@/lib/api/activity-notice";
import { ActivityNotice } from "@/lib/interfaces/activity-notice";
import { formatDate } from "@/lib/utils/date-utils";
import {
  isOperationPlanUrl,
  operationPlanLabel,
} from "@/lib/constants/operation-plan";
import {
  activityDisplayStatus,
  isActivityRecruiting,
  localDateValue,
} from "@/lib/utils/activity-recruitment";
import { ActivityTypeBadge } from "@/components/custom/activity/activity-type-badge";
import { ActivityStatusBadge } from "@/components/custom/activity/activity-status-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { activityMaterialLabel } from "@/lib/constants/activity-material";
import { STATUS_TONES } from "@/lib/constants/status-badge-tones";
import { useActivityNoticeUnread } from "@/lib/contexts/ActivityNoticeUnreadContext";
import { formatUnreadCount } from "@/lib/utils/unread-count";
import { useMenuNotification } from "@/lib/contexts/MenuNotificationContext";
import {
  ACTIVITY_RETURN_TARGETS,
  resolveActivityReturnSource,
} from "@/lib/constants/activity-navigation";

// ========================
// TYPES & HELPERS
// ========================

interface ActivityStatusMeta {
  label: string;
}

function getActivityStatusMeta(status: string): ActivityStatusMeta {
  const statusMap: Record<string, ActivityStatusMeta> = {
    CREATED: {
      label: "준비 중",
    },
    OPEN: {
      label: "모집 중",
    },
    ONGOING: {
      label: "진행 중",
    },
    COMPLETED: {
      label: "종료",
    },
  };

  return (
    statusMap[status] || {
      label: `상태: ${status}`,
      variant: "outline",
      className: "bg-gray-50 text-gray-600 border-gray-200",
    }
  );
}

interface ParticipantStatusMeta {
  label: string;
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getMyParticipantMeta(
  participant: ActivityParticipantResponse | null,
): ParticipantStatusMeta {
  if (!participant) {
    return {
      label: "미신청",
      tone: STATUS_TONES.neutral,
      icon: ClipboardList,
    };
  }

  const statusMap: Record<string, ParticipantStatusMeta> = {
    APPLIED: {
      label: "신청 완료",
      tone: STATUS_TONES.neutral,
      icon: ClipboardList,
    },
    APPROVED: {
      label: "참여 확정",
      tone: STATUS_TONES.positive,
      icon: BadgeCheck,
    },
    REJECTED: {
      label: "반려됨",
      tone: STATUS_TONES.negative,
      icon: BadgeX,
    },
  };

  return (
    statusMap[participant.status] || {
      label: participant.status,
      tone: STATUS_TONES.neutral,
      icon: ClipboardList,
    }
  );
}

interface CtaConfig {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
  secondaryActions?: Array<{
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    onClick: () => void;
  }>;
}

function deriveCtaConfig(
  activity: ActivityResponse,
  participant: ActivityParticipantResponse | null,
  capacityFull: boolean,
  handlers: {
    onApply: () => void;
    onCancel: () => void;
    onComplete: () => void;
    onLeave: () => void;
    onReapply: () => void;
  },
): CtaConfig {
  const isRecruiting = isActivityRecruiting(activity);

  if (!participant) {
    return {
      label: capacityFull ? "신청 마감" : "참여 신청",
      variant: "default",
      disabled: !isRecruiting || capacityFull,
      disabledReason: capacityFull
        ? "추가 참여 정원이 모두 찼습니다."
        : isRecruiting
          ? undefined
          : "모집 중이 아닙니다",
      onClick: handlers.onApply,
    };
  }

  if (participant.status === "APPLIED") {
    return {
      label: "신청 취소",
      variant: "outline",
      disabled: false,
      onClick: handlers.onCancel,
    };
  }

  if (participant.status === "APPROVED") {
    return {
      label: isRecruiting ? "참여 취소" : "활동 나가기",
      variant: "outline",
      onClick: handlers.onLeave,
      disabled: activity.status === "COMPLETED",
    };
  }

  if (participant.status === "REJECTED") {
    return {
      label: capacityFull ? "신청 마감" : "다시 신청",
      variant: "outline",
      disabled: !isRecruiting || capacityFull,
      disabledReason: capacityFull
        ? "추가 참여 정원이 모두 찼습니다."
        : isRecruiting
          ? undefined
          : "모집 중이 아닙니다",
      onClick: handlers.onReapply,
    };
  }

  return {
    label: "참여 신청",
    variant: "default",
    disabled: true,
    onClick: handlers.onApply,
  };
}

const STATUS_OPTIONS = [
  { value: "CREATED", label: "생성됨" },
  { value: "ONGOING", label: "진행중" },
  { value: "COMPLETED", label: "완료됨" },
];

// ========================
// INFO ROW COMPONENT
// ========================

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
    </div>
  );
}


// ========================
// MAIN COMPONENT
// ========================

export default function ActivityDetails() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = params.id as string;
  // 상세로 진입한 출처(from)에 따라 돌아갈 목적지를 결정한다.
  const from = searchParams.get("from");
  const returnSource = resolveActivityReturnSource(from) ?? "activities";
  const returnTarget = ACTIVITY_RETURN_TARGETS[returnSource];
  const returnPath = returnTarget.path;
  const returnLabel = returnTarget.label;
  // "내 활동" 계열(홈/전체 활동/수료 활동)에서 진입했는지. 기존 returnToMyActivities 참조를 대체한다.
  const isMyActivityContext =
    from === "home" || from === "home-activities" || from === "home-completed";
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [myParticipant, setMyParticipant] =
    useState<ActivityParticipantResponse | null>(null);
  const [visibleMembers, setVisibleMembers] = useState<
    ActivityParticipantSummary[]
  >([]);
  const [capacity, setCapacity] = useState<ActivityCapacityResponse | null>(
    null,
  );
  const [lectureMaterials, setLectureMaterials] = useState<LectureMaterial[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activityTab, setActivityTab] = useState<"info" | "content" | "notices">(
    "info",
  );
  const [activityNotices, setActivityNotices] = useState<ActivityNotice[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [studyDepositOpen, setStudyDepositOpen] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToPromo, setAgreedToPromo] = useState(false);
  const [refundBankName, setRefundBankName] = useState("");
  const [refundAccountNumber, setRefundAccountNumber] = useState("");
  const [refundAccountHolder, setRefundAccountHolder] = useState("");
  const [appliedPosition, setAppliedPosition] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");

  const { userRole, hasRole, userId } = useAuth();
  const canAdministerActivity = hasRole("MANAGER") || hasRole("ADMIN");
  const { markItemViewed, unreadActivityResultIds } = useMenuNotification();
  const { byActivity: unreadNoticesByActivity } = useActivityNoticeUnread();
  const unreadNoticeCount = unreadNoticesByActivity[activityId] ?? 0;

  useEffect(() => {
    void markItemViewed("activities", activityId).catch((error) => {
      console.error("Failed to mark activity card read:", error);
    });
  }, [activityId, markItemViewed]);

  useEffect(() => {
    if (!unreadActivityResultIds.includes(activityId)) return;
    void markItemViewed("activity-results", activityId).catch((error) => {
      console.error("Failed to mark activity result read:", error);
    });
  }, [activityId, markItemViewed, unreadActivityResultIds]);

  useEffect(() => {
    const fetchActivityDetails = async () => {
      setLoading(true);
      try {
        const [activityData, participantData, capacityData] =
          await Promise.all([
            getActivityById(activityId),
            getMyParticipantByActivityId(activityId),
            getActivityCapacity(activityId),
          ]);
        const recruitmentClosed =
          activityData.status === "ONGOING" ||
          activityData.status === "COMPLETED";
        let membersData: ActivityParticipantSummary[] = [];
        if (isMyActivityContext && recruitmentClosed) {
          try {
            membersData = await getActivityMemberSummaries(activityId);
          } catch (memberError) {
            console.error("Failed to fetch activity members:", memberError);
          }
        }
        setActivity(activityData);
        setMyParticipant(participantData);
        setCapacity(capacityData);
        setVisibleMembers(membersData);
      } catch (error: any) {
        console.error("Failed to fetch activity details:", error);
        toast.error(
          "활동 정보를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchActivityDetails();
  }, [activityId, isMyActivityContext]);

  // 공지는 참여 확정자·운영진·담당자만 볼 수 있어서, 권한이 확인된 뒤에 따로 불러온다.
  const canViewNotices =
    !!activity &&
    (hasRole("MANAGER") ||
      activity.assignee?.id === userId ||
      myParticipant?.status === "APPROVED");
  const showNotices = isMyActivityContext && canViewNotices;
  const showActivityContent = isMyActivityContext && canViewNotices;

  useEffect(() => {
    getLectureMaterialsByActivity(activityId)
      .then(setLectureMaterials)
      .catch((error) => {
        console.error("Failed to fetch lecture materials:", error);
        setLectureMaterials([]);
      });
  }, [activityId]);

  useEffect(() => {
    if (!showActivityContent) {
      setActivityTab((tab) => (tab === "content" ? "info" : tab));
    }
  }, [showActivityContent]);

  useEffect(() => {
    if (!showNotices) {
      setActivityNotices([]);
      // 학회 활동 상세이거나 열람 권한을 잃으면 빈 탭에 남지 않도록 되돌린다.
      setActivityTab((tab) => (tab === "notices" ? "info" : tab));
      return;
    }
    getActivityNotices(activityId)
      .then(setActivityNotices)
      .catch((error) =>
        console.error("Failed to fetch activity notices:", error),
      );
  }, [showNotices, activityId]);

  async function refreshNotices() {
    try {
      setActivityNotices(await getActivityNotices(activityId));
    } catch (error) {
      console.error("Failed to refresh activity notices:", error);
    }
  }

  const refreshCapacity = async () => {
    try {
      setCapacity(await getActivityCapacity(activityId));
    } catch (error) {
      console.error("Failed to refresh activity capacity:", error);
    }
  };

  const handleApply = async (application?: ActivityJoinRequest) => {
    if (!activity) return false;
    setActionLoading(true);
    try {
      const newParticipant = await createMyParticipantByActivityId({
        activityId: activity.id,
        application,
      });
      setMyParticipant(newParticipant);
      void refreshCapacity();
      toast.success(
        activity.activityType.code === "PROJECT"
          ? "프로젝트 참여 신청이 접수되었습니다. 개설자가 검토 후 결과를 확정합니다."
          : newParticipant.status === "APPROVED"
          ? "참여가 확정되었습니다."
          : "참여 신청이 완료되었습니다. 활동 시작일에 참여가 확정됩니다.",
      );
      return true;
    } catch (error: any) {
      console.error("Failed to apply for activity:", error);
      toast.error(
        typeof error.response?.data === "string"
          ? error.response.data
          : "참여 신청에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!myParticipant) return;
    setActionLoading(true);
    try {
      await deleteActivityParticipant(myParticipant.id);
      setMyParticipant(null);
      void refreshCapacity();
      toast.success("참여 신청이 취소되었습니다.");
    } catch (error: any) {
      console.error("Failed to cancel activity:", error);
      toast.error(
        "참여 신청을 취소하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    // TODO: Implement complete toggle logic
    console.log("Toggle complete status");
  };

  const handleLeave = async () => {
    if (!myParticipant) return;
    setActionLoading(true);
    try {
      await deleteActivityParticipant(myParticipant.id);
      setMyParticipant(null);
      void refreshCapacity();
      setLeaveDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to leave activity:", error);
      toast.error(
        "참여를 취소하는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReapply = () => {
    handleApplyClick();
  };

  const handleApplyClick = () => {
    if (!activity) return;
    if (
      (activity.activityType.code === "STUDY" ||
        activity.activityType.code === "SPECIAL_LECTURE" ||
        activity.activityType.code === "LECTURE") &&
      activity.depositAmount > 0
    ) {
      setAgreedToPolicy(false);
      setConfirmedPayment(false);
      setAgreedToPrivacy(false);
      setAgreedToPromo(false);
      setRefundBankName("");
      setRefundAccountNumber("");
      setRefundAccountHolder("");
      setStudyDepositOpen(true);
    } else {
      setAppliedPosition("");
      setApplicationMessage("");
      setApplyDialogOpen(true);
    }
  };

  const handleApplyConfirm = async () => {
    if (
      activity?.activityType.code === "PROJECT" &&
      !appliedPosition.trim()
    ) {
      toast.error("지원 포지션을 입력해주세요.");
      return;
    }
    const applied = await handleApply(
      activity?.activityType.code === "PROJECT"
        ? {
            appliedPosition: appliedPosition.trim(),
            applicationMessage: applicationMessage.trim() || undefined,
          }
        : undefined,
    );
    if (applied) setApplyDialogOpen(false);
  };

  const handleStudyDepositConfirm = async () => {
    const applied = await handleApply({
      refundBankName: refundBankName.trim(),
      refundAccountNumber,
      refundAccountHolder: refundAccountHolder.trim(),
      agreedToDepositPolicy: agreedToPolicy,
      confirmedDepositPayment: confirmedPayment,
      agreedToPrivacy: agreedToPrivacy,
      agreedToPromotion: agreedToPromo,
    });
    if (applied) setStudyDepositOpen(false);
  };

  const handleEdit = () => {
    router.push(
      `${canAdministerActivity
        ? `/manage/activities/${activityId}/edit`
        : `/home/activities/${activityId}/edit`}?from=activity-detail&detailFrom=${returnSource}`,
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!activity) return;
    try {
      const updated = await updateActivityStatus(activity.id, newStatus);
      setActivity(updated);
      if (newStatus === "ONGOING" || newStatus === "COMPLETED") {
        try {
          setVisibleMembers(await getActivityMemberSummaries(activity.id));
        } catch (memberError) {
          console.error("Failed to fetch activity members:", memberError);
          setVisibleMembers([]);
        }
      } else {
        setVisibleMembers([]);
      }
    } catch (error: any) {
      console.error("Failed to update activity status:", error);
      toast.error(
        error.response?.data?.message ||
          "활동 상태를 변경하는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
  };

  const handleDelete = async () => {
    if (!activity) return;
    try {
      await deleteActivity(activity.id);
      router.push("/activities");
    } catch (error: any) {
      console.error("Failed to delete activity:", error);
      toast.error(
        error.response?.data?.message ||
          "활동을 삭제하는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  async function refreshMaterials() {
    try {
      setLectureMaterials(await getLectureMaterialsByActivity(activityId));
    } catch (error) {
      console.error("Failed to refresh lecture materials:", error);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-3 border-b pb-6">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-7 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        {/* Description card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
        {/* Info card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-full mt-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-12">
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-lg">
              활동을 찾을 수 없습니다
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(returnPath)}
            >
              {returnLabel} 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activityStatusMeta = getActivityStatusMeta(
    activityDisplayStatus(activity),
  );
  const participantMeta = getMyParticipantMeta(myParticipant);
  const activityHasStarted = activity.startDate <= localDateValue();
  const canManage =
    canAdministerActivity || activity.assignee.id === userId;
  const activityManagementPath = canAdministerActivity
    ? `/manage/activities/${activityId}`
    : `/home/activities/${activityId}/manage`;
  const activityManagementPathWithReturn =
    `${activityManagementPath}?from=activity-detail&detailFrom=${returnSource}`;
  const canManageMaterials = canManage;
  const materialLinkLabel = activityMaterialLabel(activity.activityType.code);
  const primaryMaterial =
    lectureMaterials.find((material) => material.primary) ?? null;
  const unassignedMaterials = lectureMaterials.filter(
    (material) => material.weekNumber == null && !material.primary,
  );
  const materialSectionItems = materialLinkLabel
    ? [...(primaryMaterial ? [primaryMaterial] : []), ...unassignedMaterials]
    : unassignedMaterials;
  const ctaConfig = deriveCtaConfig(
    activity,
    myParticipant,
    capacity?.full ?? false,
    {
      onApply: handleApplyClick,
      onCancel: handleCancel,
      onComplete: handleComplete,
      onLeave: () => setLeaveDialogOpen(true),
      onReapply: handleReapply,
    },
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-8">
      <div className="space-y-2 border-b pb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(returnPath)}
          className="mb-2"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {returnLabel}
        </Button>

        <div className="space-y-3">
          <h1 className="text-xl font-bold tracking-tight">{activity.title}</h1>

          <div className="flex flex-wrap items-center gap-2">
            <ActivityTypeBadge activityType={activity.activityType} />
            <ActivityStatusBadge status={activityDisplayStatus(activity)} />
          </div>
        </div>
      </div>

      {activity.description && (
        <Card>
          <CardHeader>
            <CardTitle>설명</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold mt-3 mb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold mt-2 mb-1">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm mb-2 last:mb-0 leading-relaxed">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 mb-2 space-y-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm text-muted-foreground">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">
                    {children}
                  </strong>
                ),
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                  <code className="bg-muted text-foreground rounded px-1 py-0.5 text-xs font-mono">
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-muted pl-3 italic text-muted-foreground my-2">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-3 border-border" />,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {activity.description}
            </ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* My Participant Status Card (Mobile) */}
      <Card className="lg:hidden border-l-4 border-l-primary">
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <participantMeta.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">내 참여 상태</p>
                <p className="font-semibold">{participantMeta.label}</p>
                {myParticipant?.status === "APPLIED" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.activityType.code === "PROJECT"
                      ? "개설자가 신청 내용을 검토하고 있습니다."
                      : `${formatDate(activity.startDate)}에 참여가 확정됩니다.`}
                  </p>
                )}
                {myParticipant?.status === "REJECTED" && (
                  <div className="flex items-start gap-2 text-xs leading-relaxed">
                    <span className="shrink-0 font-medium text-foreground">
                      개설자 안내
                    </span>
                    <span className="min-w-0 text-muted-foreground">
                      {myParticipant.reviewMessage ||
                        "신청이 반려되었습니다."}
                    </span>
                </div>
                )}
                {myParticipant?.status === "APPROVED" && (
                  <Badge
                    variant={myParticipant.completed ? "default" : "outline"}
                    className="mt-1"
                  >
                    {myParticipant.completed ? "수료" : "미수료"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sidebar */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 space-y-4">
          {activity.activityType.code === "ONLINE_COURSE" && (
            <CourseTimeReservationCard activityId={activityId} />
          )}
          {activity.activityType.code === "ONLINE_COURSE" && (
            <CourseSessionReportCard
              activityId={activityId}
              myParticipant={myParticipant}
            />
          )}
          {(showActivityContent || showNotices) && (
            <div className="flex gap-1 border-b">
              <button
                type="button"
                onClick={() => setActivityTab("info")}
                className={cn(
                  "px-3 pb-2.5 text-sm font-semibold transition-colors",
                  activityTab === "info"
                    ? "border-b-2 border-[#174b3a] text-[#174b3a]"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                활동 정보
              </button>
              {showActivityContent && (
                <button
                  type="button"
                  onClick={() => setActivityTab("content")}
                  className={cn(
                    "px-3 pb-2.5 text-sm font-semibold transition-colors",
                    activityTab === "content"
                      ? "border-b-2 border-[#174b3a] text-[#174b3a]"
                      : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  활동 내용
                </button>
              )}
              {showNotices && (
                <button
                  type="button"
                  onClick={() => setActivityTab("notices")}
                  className={cn(
                    "px-3 pb-2.5 text-sm font-semibold transition-colors",
                    activityTab === "notices"
                      ? "border-b-2 border-[#174b3a] text-[#174b3a]"
                      : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    공지
                    {unreadNoticeCount > 0 && (
                      <span className="flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white">
                        {formatUnreadCount(unreadNoticeCount)}
                      </span>
                    )}
                  </span>
                </button>
              )}
            </div>
          )}

          {activityTab === "info" && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
              <CardTitle className="text-md font-semibold">활동 정보</CardTitle>
              {userRole === "MANAGER" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="관리 메뉴"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ClipboardList className="h-4 w-4 mr-2" />
                        상태 변경
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {STATUS_OPTIONS.map(({ value, label }) => (
                          <DropdownMenuItem
                            key={value}
                            disabled={activity.status === value}
                            onClick={() => handleStatusChange(value)}
                          >
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent className="divide-y divide-border px-6 pb-4 pt-0">
              {activity.quarter && (
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="분기"
                  value={`${activity.quarter.year} ${activity.quarter.season}`}
                />
              )}

              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="기간"
                value={`${formatDate(activity.startDate)} ~ ${formatDate(activity.endDate)}`}
              />

              {activity.recruitmentStartDate && activity.recruitmentEndDate && (
                <InfoRow
                  icon={<CalendarRange className="h-4 w-4" />}
                  label="모집 기간"
                  value={`${formatDate(activity.recruitmentStartDate)} ~ ${formatDate(activity.recruitmentEndDate)}`}
                />
              )}

              {(activity.activityType.code === "STUDY" ||
                activity.activityType.code === "SPECIAL_LECTURE" ||
                activity.activityType.code === "LECTURE") && (
                <InfoRow
                  icon={<Landmark className="h-4 w-4" />}
                  label="참여 보증금"
                  value={
                    activity.depositAmount > 0
                      ? `${activity.depositAmount.toLocaleString("ko-KR")}원`
                      : "없음"
                  }
                />
              )}

              {activity.activityType.code === "LECTURE" && (
                <InfoRow
                  icon={<Users className="h-4 w-4" />}
                  label="현재 신청 인원"
                  value={
                    capacity?.participantLimit == null
                      ? `${capacity?.participantCount ?? 0}명 / 제한 없음`
                      : `${capacity.participantCount} / ${capacity.participantLimit}명`
                  }
                />
              )}

              {activity.instructorCareer &&
                activity.activityType.code === "SPECIAL_LECTURE" && (
                  <div className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-xs text-muted-foreground">
                        강의자 경력
                      </p>
                      <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                        {activity.instructorCareer}
                      </p>
                    </div>
                  </div>
                )}

              {activity.operationPlan &&
                operationPlanLabel(activity.activityType.code) && (
                  <div className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-xs text-muted-foreground">
                        {operationPlanLabel(activity.activityType.code)}
                      </p>
                      {isOperationPlanUrl(activity.operationPlan) ? (
                        <a
                          href={activity.operationPlan.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#174b3a] hover:underline"
                        >
                          <span className="truncate">
                            {operationPlanLabel(activity.activityType.code)} 열기
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : (
                        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                          {activity.operationPlan}
                        </p>
                      )}
                    </div>
                  </div>
                )}

              {activity.recruitmentPositions && (
                <div className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 text-muted-foreground">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs text-muted-foreground">
                      희망 포지션
                    </p>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {activity.recruitmentPositions}
                    </p>
                  </div>
                </div>
              )}

              <InfoRow
                icon={<User className="h-4 w-4" />}
                label={
                  activity.activityType.code === "SPECIAL_LECTURE"
                    ? "강의자"
                    : "담당자"
                }
                value={activity.assignee.name}
              />

              <div className="flex items-start gap-3 py-3">
                <div className="mt-0.5 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {materialLinkLabel ?? "활동 자료"}
                    </p>
                    {canManageMaterials && (
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-[#174b3a] hover:underline"
                        onClick={() =>
                          router.push(
                            `/lecture-materials?activityId=${activityId}&create=true`,
                          )
                        }
                      >
                        자료 추가
                      </button>
                    )}
                  </div>
                  {materialSectionItems.length === 0 ? (
                    <p className="text-sm font-medium">—</p>
                  ) : (
                    <div className="space-y-1.5">
                      {materialSectionItems.map((material) => (
                        <a
                          key={material.id}
                          href={material.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#174b3a] hover:underline"
                        >
                          <span className="truncate">{material.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* My Participant Status (Desktop) */}
              <div className="hidden lg:flex items-start gap-3 py-3">
                <div className="mt-0.5 text-muted-foreground">
                  <participantMeta.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    내 참여 상태
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={participantMeta.tone}>
                      {participantMeta.label}
                    </Badge>
                    {myParticipant?.status === "APPROVED" && (
                      <Badge
                        variant={
                          myParticipant.completed ? "default" : "outline"
                        }
                        className="text-xs"
                      >
                        {myParticipant.completed ? "수료" : "미수료"}
                      </Badge>
                    )}
                  </div>
                  {myParticipant?.status === "APPLIED" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.activityType.code === "PROJECT"
                        ? "개설자가 신청 내용을 검토하고 있습니다."
                        : `${formatDate(activity.startDate)}에 참여가 확정됩니다.`}
                    </p>
                  )}
                  {myParticipant?.status === "REJECTED" && (
                    <div className="flex items-start gap-2 text-xs leading-relaxed">
                      <span className="shrink-0 font-medium text-foreground">
                        개설자 안내
                      </span>
                      <span className="min-w-0 text-muted-foreground">
                        {myParticipant.reviewMessage ||
                          "신청이 반려되었습니다."}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary CTA */}
              <div className="space-y-2 pt-4">
                <Button
                  className="w-full"
                  variant={ctaConfig.variant}
                  disabled={ctaConfig.disabled || actionLoading}
                  onClick={ctaConfig.onClick}
                  aria-label={ctaConfig.label}
                >
                  {actionLoading ? "처리 중..." : ctaConfig.label}
                </Button>
                {ctaConfig.disabledReason && ctaConfig.disabled && (
                  <p className="text-xs text-muted-foreground text-center">
                    {ctaConfig.disabledReason}
                  </p>
                )}
                {ctaConfig.secondaryActions &&
                  ctaConfig.secondaryActions.map((action, index) => (
                    <Button
                      key={index}
                      className="w-full"
                      variant={action.variant}
                      onClick={action.onClick}
                      disabled={actionLoading}
                    >
                      {action.label}
                    </Button>
                  ))}
                {canManage && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => router.push(activityManagementPathWithReturn)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    활동 관리하러 가기
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {activityTab === "content" && showActivityContent && (
            <WeeklyMaterials
              activityId={activityId}
              materials={lectureMaterials}
              discordUrl={activity.discordUrl}
              canManage={canManage}
              onChanged={refreshMaterials}
            />
          )}

          {activityTab === "notices" && showNotices && (
            <ActivityNotices
              activityId={activityId}
              notices={activityNotices}
              canManage={canManage}
              onChanged={refreshNotices}
            />
          )}
        </div>
      </div>

      {isMyActivityContext &&
        (activity.status === "ONGOING" || activity.status === "COMPLETED") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              참여자
              <span className="text-sm font-normal text-muted-foreground">
                {visibleMembers.length}명
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visibleMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                확정된 참여자가 없습니다.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {visibleMembers.map((member) => (
                  <li key={member.id} className="text-sm font-medium">
                    {member.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemValue={activity.title}
        onConfirm={handleDelete}
      />

      <AlertDialog
        open={applyDialogOpen}
        onOpenChange={(open) => {
          if (!actionLoading) setApplyDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activity.title} 참여를 신청하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activity.activityType.code === "PROJECT" ? (
                <>
                  신청은 개설자 검토 후 참여가 확정됩니다. 신청 결과는 내 활동 탭에서 확인할 수
                  있습니다.
                </>
              ) : activityHasStarted ? (
                <>신청 즉시 참여가 확정됩니다.</>
              ) : (
                <>
                  신청 후 {formatDate(activity.startDate)}에 참여가 자동으로
                  확정됩니다. 시작 전까지 신청을 취소할 수 있습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {activity.activityType.code === "PROJECT" && (
            <div className="space-y-4 py-1">
              {activity.recruitmentPositions && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="mb-1 font-medium">모집 포지션</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {activity.recruitmentPositions}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="applied-position" className="text-sm font-medium">
                  지원 포지션 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="applied-position"
                  value={appliedPosition}
                  onChange={(event) => setAppliedPosition(event.target.value)}
                  placeholder="예: 프론트엔드"
                  maxLength={100}
                  disabled={actionLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="application-message" className="text-sm font-medium">
                  관련 경험 및 지원 내용 <span className="text-muted-foreground">(선택)</span>
                </label>
                <textarea
                  id="application-message"
                  value={applicationMessage}
                  onChange={(event) => setApplicationMessage(event.target.value)}
                  placeholder="포지션과 관련된 경험이나 함께하고 싶은 이유를 작성해주세요."
                  maxLength={1000}
                  rows={4}
                  disabled={actionLoading}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              돌아가기
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={(event) => {
                event.preventDefault();
                void handleApplyConfirm();
              }}
            >
              {actionLoading ? "신청 중..." : "참여 신청"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>활동에서 나가시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              활동에서 나가면 참여 기록이 삭제됩니다. 다시 참가하려면 재신청이
              필요합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deposit and refund account dialog */}
      <Dialog
        open={studyDepositOpen}
        onOpenChange={(open) => {
          if (!open) setStudyDepositOpen(false);
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">

          <DialogHeader>
            <DialogTitle>보증금 납부 및 환급 안내</DialogTitle>
            <DialogDescription>
              신청 전에 납부 기준을 확인하고 환급받을 계좌를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            <div className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold d-800">
                    참여 보증금
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-950">
                    {activity.depositAmount.toLocaleString("ko-KR")}원
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
                  수료 시 전액 환급
                </div>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                꼭 확인해주세요
              </h3>
              <div className="space-y-2 rounded-md border bg-muted/30 p-4 leading-relaxed text-muted-foreground">
                <p>
                  수료 조건을 충족하지 못하면 보증금은 환급되지 않습니다.
                  미환급 보증금은 강의비 및 CNU 운영비로 사용됩니다.
                </p>
                <div className="border-t pt-2.5">
                  <p className="font-medium text-foreground">입금 계좌</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    토스뱅크 1002-3463-0651 홍준영
                  </p>
                </div>
                <div className="border-t pt-2.5">
                  <p className="font-medium text-foreground">입금자명</p>
                  <p className="mt-1">
                    본인 성함으로 입금자명을 설정해주세요.
                  </p>

                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 font-semibold">
                환급 계좌 정보
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    은행
                  </span>
                  <Input
                    value={refundBankName}
                    onChange={(event) => setRefundBankName(event.target.value)}
                    maxLength={50}
                    autoComplete="off"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    예금주
                  </span>
                  <Input
                    value={refundAccountHolder}
                    onChange={(event) =>
                      setRefundAccountHolder(event.target.value)
                    }
                    placeholder="예금주 이름"
                    maxLength={50}
                    autoComplete="off"
                  />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    계좌번호
                  </span>
                  <Input
                    value={refundAccountNumber}
                    onChange={(event) =>
                      setRefundAccountNumber(
                        event.target.value.replace(/[^0-9-]/g, ""),
                      )
                    }
                    placeholder="숫자 또는 하이픈으로 입력"
                    inputMode="numeric"
                    maxLength={24}
                    autoComplete="off"
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                입력한 정보는 보증금 환급 업무에만 사용됩니다.
              </p>
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">개인정보 수집·이용 동의</h3>
              <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                <div className="space-y-1">
                  <p>
                    <span className="font-medium text-foreground">수집 항목</span>
                    {" · "}은행명, 예금주명, 계좌번호
                  </p>
                  <p>
                    <span className="font-medium text-foreground">이용 목적</span>
                    {" · "}활동 보증금 환급
                  </p>
                  <p>
                    <span className="font-medium text-foreground">보유 기간</span>
                    {" · "}보증금 환급 완료 후 파기
                  </p>
                </div>
                <p className="border-t pt-2.5">
                  개인정보 수집·이용에 대한 동의를 거부할 수 있으나, 동의하지 않을
                  경우 해당 활동 참여 신청이 제한될 수 있습니다.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 leading-relaxed">
                <Checkbox
                  className="mt-0.5"
                  checked={agreedToPrivacy}
                  onCheckedChange={(v) => setAgreedToPrivacy(!!v)}
                />
                <span>[필수] 개인정보 수집·이용에 동의합니다.</span>
              </label>
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">필수 확인</h3>
              <label className="flex cursor-pointer items-start gap-2.5 leading-relaxed">
                <Checkbox
                  className="mt-0.5"
                  checked={agreedToPolicy}
                  onCheckedChange={(v) => setAgreedToPolicy(!!v)}
                />
                <span>보증금 납부 및 환급 기준을 확인했습니다.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 leading-relaxed">
                <Checkbox
                  className="mt-0.5"
                  checked={confirmedPayment}
                  onCheckedChange={(v) => setConfirmedPayment(!!v)}
                />
                <span>보증금 입금을 완료하였습니다.</span>
              </label>
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">
                선택 동의
              </h3>
              <label className="flex cursor-pointer items-start gap-2.5 leading-relaxed">
                <Checkbox
                  className="mt-0.5"
                  checked={agreedToPromo}
                  onCheckedChange={(v) => setAgreedToPromo(!!v)}
                />
                <span>
                  활동 사진 및 결과물의 교내 소식지 등 홍보 활용에 동의합니다.
                </span>
              </label>
            </section>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setStudyDepositOpen(false)}>
              취소
            </Button>
            <Button
              disabled={
                !refundBankName.trim() ||
                refundAccountNumber.replace(/\D/g, "").length < 8 ||
                !refundAccountHolder.trim() ||
                !agreedToPolicy ||
                !confirmedPayment ||
                !agreedToPrivacy ||
                actionLoading
              }
              onClick={handleStudyDepositConfirm}
            >
              {actionLoading ? "신청 중..." : "참여 신청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
