"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApplicantNotification } from "@/lib/contexts/ApplicantNotificationContext";
import { ActivityApplicantCount } from "@/lib/interfaces/applicant-notification";
import { useAuth } from "@/lib/contexts/AuthContext";
import { formatUnreadCount } from "@/lib/utils/unread-count";
import { cn } from "@/lib/utils";

export function ApplicantNotificationBell({ className }: { className?: string }) {
  const { totalCount, byActivity, isLoading, acknowledge } =
    useApplicantNotification();
  const { userRole } = useAuth();
  const [open, setOpen] = useState(false);
  // 패널을 열 때 받은 목록을 스냅샷으로 들고 있는다.
  // 컨텍스트 값을 그대로 쓰면 60초 폴링/포커스 갱신이 열려 있는 패널의 목록을 지워버린다.
  const [entries, setEntries] = useState<ActivityApplicantCount[]>([]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    // 폴링으로 이미 받아둔 목록을 먼저 보여주고, 확인 처리 응답으로 한 번 더 맞춘다
    setEntries(byActivity);
    void acknowledge().then(setEntries);
  };

  const linkForActivity = (activityId: string) =>
    userRole === "ADMIN" || userRole === "MANAGER"
      ? `/manage/activities/${activityId}`
      : `/home/activities/${activityId}/manage`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative rounded-none text-white/80 hover:bg-white/10 hover:text-white",
            className,
          )}
          aria-label="알림"
        >
          <Bell className="size-4" />
          {totalCount > 0 && (
            <span
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white"
              aria-label="새 알림"
            >
              {formatUnreadCount(totalCount)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">
          알림
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              불러오는 중...
            </div>
          ) : entries.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              새로운 알림이 없습니다
            </div>
          ) : (
            <ul className="divide-y">
              {entries.map((entry) => (
                <li key={entry.activityId}>
                  <Link
                    href={linkForActivity(entry.activityId)}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                    onClick={() => setOpen(false)}
                  >
                    <span className="truncate">{entry.activityTitle}</span>
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                      새 신청 {entry.newApplicantCount}명
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
