"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HomeLink } from "@/components/custom/home-link";
import { usePathname } from "next/navigation";
import { Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCurrentQuarter } from "@/lib/api/quarter";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { getMenuByRole } from "@/lib/constants/menu-config";
import { useLectureParticipation } from "@/lib/hooks/useLectureParticipation";
import { useMyName } from "@/lib/hooks/useMyName";
import { useSidebarBadges } from "@/lib/hooks/useSidebarBadges";
import { formatUnreadCount } from "@/lib/utils/unread-count";

// Figma "App sidebar" (Deep mode): logo, user card, text-only items split by dividers,
// 홈으로 / 로그아웃 at the bottom.
const ITEM =
  "flex h-[35px] w-full items-center rounded-[4px] px-3 text-sm transition-colors";
const ITEM_IDLE = "text-[#dcebd2] hover:bg-[#dcebd2]/[0.08]";
const ITEM_ACTIVE = "bg-[#1c7451] font-medium text-[#8fe3b0]";

function useCurrentQuarterName() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getCurrentQuarter()
      .then((quarter) => alive && setName(quarter.name))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return name;
}

function SidebarUserCard({ onNavigate }: { onNavigate?: () => void }) {
  const { userRole } = useAuth();
  const name = useMyName();
  const quarter = useCurrentQuarterName();

  return (
    <Link
      href="/profile"
      onClick={() => onNavigate?.()}
      className="flex items-center gap-3 rounded-[4px] bg-[#136746] p-3 transition-colors hover:bg-[#176d4b]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#8fe3b0] text-sm font-medium text-[#10603f]">
        {name?.slice(0, 1) ?? ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[#dcebd2]">{name ?? " "}</span>
        <span className="font-cnu-numeric block truncate text-xs tracking-wide text-[#a8cbb2]">
          {quarter ? `${userRole} · ${quarter}` : userRole}
        </span>
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { userRole, roles, hasRole, logout } = useAuth();
  const { getUnreadCount } = useSidebarBadges();
  const { loading: lectureLoading, participant: lectureParticipant } =
    useLectureParticipation();
  const canSeeOnlineLecture = hasRole("MANAGER") || (!lectureLoading && !!lectureParticipant);
  const menuItems = getMenuByRole(userRole, roles)
    .filter((item) => {
      if (item.type === "separator") return true;
      // 운영자/관리자는 항상 보이고, 그 외엔 인강 신청자(참여 확정)일 때만 보인다.
      if (item.href === "/online-lecture") {
        return canSeeOnlineLecture;
      }
      return true;
    })
    // 내 프로필 stands on its own above the 학회원 group (Figma), so divide it off.
    .flatMap((item, index, all) =>
      item.type !== "separator" &&
      item.href === "/profile" &&
      all[index + 1] &&
      all[index + 1].type !== "separator"
        ? [item, { type: "separator" as const }]
        : [item],
    );

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-6">
      <HomeLink
        onClick={() => onNavigate?.()}
        className="w-fit pl-2 transition-opacity hover:opacity-80"
        aria-label="CNU 홈"
      >
        <Image src="/cnu-header-logo.png" alt="" width={28} height={28} className="rounded-[7px]" />
      </HomeLink>

      <SidebarUserCard onNavigate={onNavigate} />

      <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
        <nav className="flex flex-col gap-0.5">
          {menuItems.map((item, index) => {
            if (item.type === "separator") {
              return (
                <hr
                  key={`separator-${index}`}
                  className="my-[11px] border-0 border-t border-[#dcebd2]/20"
                />
              );
            }

            const isActive =
              pathname === item.href ||
              (item.href === "/manage/activities" &&
                pathname.startsWith("/manage/activities/"));
            const unreadCount = getUnreadCount(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onNavigate?.()}
                className={cn(ITEM, isActive ? ITEM_ACTIVE : ITEM_IDLE)}
              >
                <span className="flex-1 text-left">{item.label}</span>
                {/* Only the system menu carries an icon (gear), set apart from the rest. */}
                {item.href === "/admin" && <Settings className="size-4 opacity-80" />}
                {unreadCount > 0 && (
                  <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-[#ffb4ab] px-1.5 text-[11px] font-semibold leading-5 text-[#690005]">
                    {formatUnreadCount(unreadCount)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="flex flex-col gap-0.5">
        <HomeLink onClick={() => onNavigate?.()} className={cn(ITEM, ITEM_IDLE)}>
          홈으로
        </HomeLink>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            logout();
          }}
          className={cn(ITEM, ITEM_IDLE, "cursor-pointer")}
        >
          로그아웃
        </button>
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

      {/* Mobile drawer (opened from the app top bar) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[264px] bg-[#10603f] text-[#dcebd2] transition-transform duration-200 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-4 z-10 text-[#dcebd2] hover:bg-[#dcebd2]/[0.08] hover:text-[#dcebd2]"
          onClick={() => setIsOpen(false)}
          aria-label="메뉴 닫기"
        >
          <X className="size-4" />
        </Button>
        <SidebarContent onNavigate={() => setIsOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-40 hidden h-dvh w-[264px] shrink-0 flex-col bg-[#10603f] md:flex">
        <SidebarContent />
      </aside>
    </>
  );
}
