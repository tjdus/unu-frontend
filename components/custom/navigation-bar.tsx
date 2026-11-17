"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Home, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentQuarter } from "@/lib/api/quarter";
import { QuarterResponse } from "@/lib/interfaces/quarter";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { useSidebarBadges } from "@/lib/hooks/useSidebarBadges";
import { PublicNavLinks } from "@/components/custom/public-nav-links";
import { TimedAnchorLink } from "@/components/custom/timed-anchor-link";
import { menuConfig } from "@/lib/constants/menu-config";
import aboutStyles from "@/app/about/about.module.css";
import homeStyles from "./home-deep.module.css";
import editorialStyles from "./editorial.module.css";

const INTERNAL_ROUTE_PREFIXES = Array.from(
  new Set([
    ...Object.values(menuConfig)
      .flat()
      .flatMap((item) => ("href" in item ? [item.href] : [])),
    "/forms",
    "/activity-opening",
  ]),
);

export function NavigationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { userRole, logout, isLoading } = useAuth();
  const { setIsOpen } = useSidebar();
  const { hasAnyUnread } = useSidebarBadges();
  const [currentQuarter, setCurrentQuarter] =
    React.useState<QuarterResponse | null>(null);

  React.useEffect(() => {
    getCurrentQuarter().then(setCurrentQuarter).catch(() => undefined);
  }, []);

  const isMainRoute = INTERNAL_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const [, route, , action] = pathname.split("/");
  // Blog / Work pages, including their create and edit screens, sit on the deep editorial surface.
  const isEditorial =
    pathname === "/login" ||
    ((route === "portfolio" || route === "blog") && (!action || action === "edit"));  const isDeepHeader = pathname === "/about" || isEditorial;

  const rightContent = () => {
    if (isLoading) return isDeepHeader ? null : <div className="h-16 w-20 sm:w-[133px]" />;

    if (userRole === "GUEST") {
      return (
        <Link
          href="/login"
          aria-current={pathname === "/login" ? "page" : undefined}
          className={isDeepHeader
            ? `${homeStyles.heroLogin} ${aboutStyles.navLogin} ${editorialStyles.navLogin}`
            : "cnu-nav-item font-cnu-body flex h-16 items-center justify-center px-4 text-base text-white/80 transition-colors hover:text-white sm:w-[133px] sm:px-0 sm:text-[17.8px]"}
        >
          {isDeepHeader ? "Login" : "로그인"}
        </Link>
      );
    }

    // Public deep pages (About Us / Work / Blog / Login): a plain "My Page" link in the
    // same type as "Login", like the home hero, instead of the profile dropdown.
    if (isDeepHeader) {
      return (
        <Link
          href="/home"
          className={`${homeStyles.heroLogin} ${aboutStyles.navLogin} ${editorialStyles.navLogin}`}
        >
          My Page
        </Link>
      );
    }

    return (
      <div className={isDeepHeader ? homeStyles.heroLogin : "flex h-16 items-center gap-2 pr-3 md:gap-4 md:pr-6"}>
        {/* {currentQuarter && (
          <span className="font-cnu-body hidden text-sm font-medium text-[#777777] sm:block">
           {currentQuarter.year} {currentQuarter.season.toUpperCase()}
          </span>
        )} 없어도 될듯 해서 뺍니다 */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={isDeepHeader
              ? "font-cnu-body gap-2 px-2 hover:bg-transparent hover:text-white"
              : "cnu-nav-item font-cnu-body h-full gap-2 rounded-none text-white/80 hover:bg-transparent hover:text-white"}
            aria-label={isDeepHeader ? "프로필 메뉴" : undefined}
          >
            <span className="relative">
              <User className="size-4" />

              {hasAnyUnread && (
                <span
                  className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500 ring-2 ring-[#14231b] sm:hidden"
                  aria-label="새 알림"
                />
              )}
            </span>

            <span className="hidden items-center gap-1.5 sm:flex">
              프로필
              {hasAnyUnread && (
                <span
                  className="size-2 rounded-full bg-red-500"
                  aria-label="새 알림"
                />
              )}
            </span>

            <ChevronDown className="size-4" />
          </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => router.push("/home")}
            className="flex items-center"
          >
            <Home className="mr-2 size-4" />
            <span>홈</span>

            {hasAnyUnread && (
              <span
                className="ml-auto size-2 rounded-full bg-red-500"
                aria-label="새 알림"
              />
            )}
          </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User className="mr-2 size-4" />프로필
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 size-4" />로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // The home page carries its own hero navigation instead of the global bar.
  if (pathname === "/") return null;
  // The logged-in app uses its own sidebar (brand, home, logout) instead of the global bar.
  if (isMainRoute) return null;

  if (isDeepHeader) {
    return (
      <header className={isEditorial ? `${aboutStyles.header} ${editorialStyles.archiveHeader}` : aboutStyles.header}>
        <div className={aboutStyles.headerInner}>
          <PublicNavLinks variant="deep" />
          {rightContent()}
          <Link href="/" className={aboutStyles.brand} aria-label="CNU 홈">
            <Image
              src="/cnu-header-logo.png"
              alt=""
              width={28}
              height={28}
              className="rounded-[7px]"
              priority
            />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 w-full shrink-0 items-center border-b border-white/10 bg-[#14231b] pl-4 md:pl-[26px]">
      {!isLoading && userRole !== "GUEST" && isMainRoute && (
        <Button
          variant="ghost"
          size="icon"
          className="cnu-nav-item mr-2 h-full rounded-none text-white hover:bg-transparent hover:text-white md:hidden"
          onClick={() => setIsOpen(true)}
          aria-label="메뉴 열기"
        >
          <Menu className="size-5" />
        </Button>
      )}

      <TimedAnchorLink
        href="/"
        targetId="home-top"
        duration={900}
        className="relative size-8 shrink-0 overflow-hidden rounded-lg transition-opacity hover:opacity-80"
      >
        <Image
          src="/cnu-header-logo.png"
          alt="CNU"
          fill
          sizes="32px"
          className="object-cover"
          priority
        />
        <span className="sr-only">CNU 홈</span>
      </TimedAnchorLink>

      <div className="ml-auto flex h-16 items-stretch">
        <PublicNavLinks
          showMobile={!isLoading && (userRole === "GUEST" || !isMainRoute)}
        />
        {rightContent()}
      </div>
    </header>
  );
}
