"use client";

import Image from "next/image";
import { HomeLink } from "@/components/custom/home-link";
import { useRouter } from "next/navigation";
import { Activity, ArrowUpRight, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { useMyName } from "@/lib/hooks/useMyName";
import { useSidebarBadges } from "@/lib/hooks/useSidebarBadges";

/**
 * Mobile-only top app bar for the logged-in app: opens the sidebar drawer and holds the
 * profile menu. On larger screens the sidebar (logo, user card) covers both, so the page
 * title is the only header.
 */
export function AppTopBar() {
  const router = useRouter();
  const { setIsOpen } = useSidebar();
  const { userRole, logout } = useAuth();
  const { hasAnyUnread } = useSidebarBadges();
  const name = useMyName();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 rounded-t-2xl border-b border-[#c0c9c0] bg-white/90 backdrop-blur md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-2 md:hidden"
        onClick={() => setIsOpen(true)}
        aria-label="메뉴 열기"
      >
        <Menu className="size-5" />
      </Button>
      <HomeLink className="mr-1 md:hidden" aria-label="CNU 홈">
        <Image src="/cnu-header-logo.png" alt="" width={26} height={26} className="rounded-md" />
      </HomeLink>

      <span className="flex-1" />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative flex size-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[#37825d]/[0.08]"
            aria-label="프로필 메뉴"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-[#b8f0cf] text-sm font-medium text-[#002113]">
              {name?.slice(0, 1) ?? <User className="size-4" />}
            </span>
            {hasAnyUnread && (
              <span
                className="absolute right-1 top-1 size-2.5 rounded-full bg-[#ba1a1a] ring-2 ring-white"
                aria-label="새 알림"
              />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium">{name ?? ""}</span>
            <span className="font-cnu-numeric block text-xs text-muted-foreground">{userRole}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/home")}>
            <Activity className="mr-2 size-4" />내 활동
            {hasAnyUnread && <span className="ml-auto size-2 rounded-full bg-[#ba1a1a]" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <User className="mr-2 size-4" />내 프로필
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/")}>
            <ArrowUpRight className="mr-2 size-4" />
            사이트로 이동
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 size-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
