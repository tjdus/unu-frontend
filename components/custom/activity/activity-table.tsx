import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchActivities } from "@/lib/api/activity";
import {
  ACTIVITY_STATUS_MAP,
  ActivityResponse,
} from "@/lib/interfaces/activity";
import {
  getMyParticipantByActivityId,
  createMyParticipantByActivityId,
  deleteActivityParticipant,
} from "@/lib/api/activity-participant";
import {
  ActivityParticipantResponse,
  ACTIVITY_PARTICIPANT_STATUS_MAP,
} from "@/lib/interfaces/activity-participant";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ActivityTableProps {
  quarter?: string;
  activityType?: string;
  status?: string;
  searchTerm?: string;
}

export function ActivityTable({
  quarter,
  activityType,
  status,
  searchTerm,
}: ActivityTableProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [participantMap, setParticipantMap] = useState<
    Record<string, ActivityParticipantResponse | null>
  >({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      try {
        const data = await searchActivities({
          title: searchTerm,
          status,
          activityTypeId: activityType,
          quarterId: quarter,
        });
        setActivities(data);

        // Fetch participant status for each activity
        const participantData: Record<
          string,
          ActivityParticipantResponse | null
        > = {};
        await Promise.all(
          data.map(async (activity) => {
            const participant = await getMyParticipantByActivityId(activity.id);
            participantData[activity.id] = participant;
          }),
        );
        setParticipantMap(participantData);
      } catch (error: any) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [quarter, activityType, status, searchTerm]);

  const handleApply = async (activityId: string) => {
    setApplyingId(activityId);
    try {
      const participant = await createMyParticipantByActivityId({ activityId });
      setParticipantMap((prev) => ({
        ...prev,
        [activityId]: participant,
      }));
    } catch (error: any) {
      console.error("Failed to apply for activity:", error);
    } finally {
      setApplyingId(null);
    }
  };

  const handleCancel = async (activityId: string, participantId: string) => {
    setCancelingId(activityId);
    try {
      await deleteActivityParticipant(participantId);
      setParticipantMap((prev) => ({
        ...prev,
        [activityId]: null,
      }));
    } catch (error: any) {
      console.error("Failed to cancel activity:", error);
    } finally {
      setCancelingId(null);
    }
  };

  const handleRowClick = (activityId: string) => {
    router.push(`/activities/${activityId}`);
  };

  const renderActionButton = (activity: ActivityResponse) => {
    const participant = participantMap[activity.id];
    const isApplying = applyingId === activity.id;
    const isCanceling = cancelingId === activity.id;

    if (activity.status === "CREATED") {
      return (
        <Button variant="outline" disabled size="sm">
          모집 예정
        </Button>
      );
    }

    // 모집중이 아니면 버튼 비활성화
    if (activity.status !== "OPEN") {
      return (
        <Button variant="outline" disabled size="sm">
          모집 종료
        </Button>
      );
    }

    // 신청하지 않았으면 신청 버튼
    if (!participant) {
      return (
        <Button
          onClick={() => handleApply(activity.id)}
          disabled={isApplying}
          size="sm"
        >
          {isApplying ? "신청 중..." : "참여 신청"}
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        onClick={() => handleCancel(activity.id, participant.id)}
        disabled={isCanceling}
        size="sm"
      >
      {isCanceling
        ? "취소 중..."
        : participant.status === "APPLIED"
          ? "신청 취소"
          : "참여 취소"}
      </Button>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-center">제목</TableHead>
          <TableHead className="text-center">설명</TableHead>
          <TableHead className="text-center">상태</TableHead>
          <TableHead className="text-center">활동 유형</TableHead>
          <TableHead className="text-center">담당자</TableHead>
          <TableHead className="text-center">분기</TableHead>
          <TableHead className="text-center">액션</TableHead>
        </TableRow>
      </TableHeader>
      {(loading || quarter === "") && (
        <TableBody>
          <TableRow>
            <TableCell colSpan={7}>
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      )}
      {activities.length === 0 && !loading && quarter !== "" && (
        <TableBody>
          <TableRow>
            <TableCell colSpan={7} className="text-center">
              활동이 없습니다
            </TableCell>
          </TableRow>
        </TableBody>
      )}
      <TableBody>
        {activities.map((activity) => (
          <TableRow
            key={activity.id}
            onClick={() => handleRowClick(activity.id)}
            className="cursor-pointer hover:bg-muted/50"
          >
            <TableCell className="font-medium">{activity.title}</TableCell>
            <TableCell>{activity.description}</TableCell>
            <TableCell>
              {ACTIVITY_STATUS_MAP[activity.status] || activity.status}
            </TableCell>
            <TableCell>{activity.activityType.name}</TableCell>
            <TableCell>{activity.assignee.name}</TableCell>
            <TableCell>{activity.quarter.name}</TableCell>
            <TableCell className="text-center">
              {renderActionButton(activity)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
