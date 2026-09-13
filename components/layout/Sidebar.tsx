"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { getMenuByRole } from "@/lib/constants/menu-config";
import { useLectureParticipation } from "@/lib/hooks/useLectureParticipation";
import { useSidebarBadges } from "@/lib/hooks/useSidebarBadges";
import { formatUnreadCount } from "@/lib/utils/unread-count";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { userRole, roles, hasRole } = useAuth();
  const { getUnreadCount } = useSidebarBadges();
  const { loading: lectureLoading, participant: lectureParticipant } =
    useLectureParticipation();
  const canSeeOnlineLecture = hasRole("MANAGER") || (!lectureLoading && !!lectureParticipant);
  const menuItems = getMenuByRole(userRole, roles).filter((item) => {
    if (item.type === "separator") return true;
    // 운영자/관리자는 항상 보이고, 그 외엔 인강 신청자(참여 확정)일 때만 보인다.
    if (item.href === "/online-lecture") {
      return canSeeOnlineLecture;
    }
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {menuItems.map((item, index) => {
            if (item.type === "separator") {
              return <Separator key={`separator-${index}`} className="my-2" />;
            }

            const isCurrentQuarterActive =
              pathname === item.href ||
              (item.href === "/manage/activities" &&
                pathname.startsWith("/manage/activities/"));
            const Icon = item.icon;
            const unreadCount = getUnreadCount(item.href);

            return (
              <Button
                key={item.href}
                variant={isCurrentQuarterActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isCurrentQuarterActive && "bg-secondary font-semibold",
                )}
                asChild
                onClick={() => {
                  onNavigate?.();
                }}
              >
                <Link href={item.href}>
                  <Icon className="mr-3 h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-5 text-white">
                      {formatUnreadCount(unreadCount)}
                    </span>
                  )}
                </Link>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="text-sm">
          <p className="font-medium">권한</p>
          <p className="text-muted-foreground">{userRole}</p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, setIsOpen } = useSidebar();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-background transition-transform duration-200 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex justify-end p-2 border-b">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(100%-49px)]">
          <SidebarContent onNavigate={() => setIsOpen(false)} />
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="sticky top-16 z-40 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 flex-col border-r bg-background md:flex">
        <SidebarContent />
      </aside>
    </>
  );
}
