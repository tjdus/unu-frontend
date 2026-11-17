"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimedAnchorLink } from "@/components/custom/timed-anchor-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBlogPosts } from "@/lib/api/blog";
import { getPortfolios } from "@/lib/api/portfolio";
import aboutStyles from "@/app/about/about.module.css";
import homeStyles from "./home-deep.module.css";
import styles from "./public-nav-links.module.css";

const NAV_ITEMS = [
  {
    label: "소개",
    englishLabel: "About Us",
    href: "/about",
    width: "w-[126px]",
  },
  {
    label: "활동",
    englishLabel: "Work",
    href: "/portfolio",
    width: "w-[126px]",
    preload: getPortfolios,
  },
  {
    label: "블로그",
    englishLabel: "Blog",
    href: "/blog",
    width: "w-[133px]",
    preload: getBlogPosts,
  },
  {
    label: "문의",
    englishLabel: "Contact",
    href: "/#contact",
    width: "w-[126px]",
    targetId: "contact",
  },
];

interface PublicNavLinksProps {
  showMobile?: boolean;
  variant?: "deep" | "home";
}

export function PublicNavLinks({ showMobile = true, variant }: PublicNavLinksProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolledPastNav, setScrolledPastNav] = useState(false);
  const topNav = useRef<HTMLElement>(null);
  const deep = variant === "deep" || variant === "home";
  const home = variant === "home";
  const docked = home && scrolledPastNav;

  useEffect(() => {
    if (!home || !topNav.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setScrolledPastNav(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(topNav.current);
    return () => observer.disconnect();
  }, [home]);

  const renderLinks = (inDock = false) => NAV_ITEMS.map(({ label, englishLabel, href, width, targetId, preload }) => {
    const route = href.split("#")[0] || "/";
    const isActive = route !== "/" && (pathname === route || pathname.startsWith(`${route}/`));
    const className = inDock ? styles.dockLink : deep ? undefined : cn(
      "cnu-nav-item font-cnu-body flex h-16 items-center justify-center text-[17.8px] font-normal tracking-[0.18px] transition-colors hover:text-white",
      width,
      isActive ? "text-white" : "text-white/80",
    );

    if (targetId) {
      return (
        <TimedAnchorLink
          key={href}
          href={home ? undefined : href}
          targetId={targetId}
          duration={0}
          updateHash={!home}
          className={className}
        >
          {deep ? englishLabel : label}
        </TimedAnchorLink>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        className={className}
        aria-current={isActive ? "page" : undefined}
        onMouseEnter={() => void preload?.().catch(() => undefined)}
        onFocus={() => void preload?.().catch(() => undefined)}
      >
        {deep ? englishLabel : label}
      </Link>
    );
  });

  return (
    <>
      <nav ref={topNav} inert={docked}
        data-hero-bound-right={home ? "" : undefined}
        className={deep ? cn(homeStyles.heroNav, aboutStyles.navLinks) : "hidden h-16 items-stretch md:flex"}
        aria-label={home ? "홈 바로가기" : "공개 메뉴"}
      >
        {renderLinks()}
      </nav>

      {docked && createPortal(
        <nav className={styles.dock} aria-label="하단 공개 메뉴">
          {renderLinks(true)}
        </nav>,
        document.body,
      )}

      {showMobile && !deep && (
        <div className="flex h-16 items-center md:hidden">
          <DropdownMenu
            modal={false}
            open={mobileMenuOpen}
            onOpenChange={setMobileMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="cnu-nav-item h-16 w-14 rounded-none text-white/80 hover:bg-transparent hover:text-white"
                aria-label="사이트 메뉴 열기"
              >
                <Menu className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {NAV_ITEMS.map(({ label, href, targetId, preload }) => {
                const route = href.split("#")[0] || "/";
                const isActive = route !== "/" && pathname.startsWith(route);
                const itemClassName = cn(
                  "font-cnu-body cursor-pointer",
                  isActive && "bg-accent font-medium",
                );

                if (targetId) {
                  return (
                    <DropdownMenuItem key={href} asChild className={itemClassName}>
                      <TimedAnchorLink
                        href={href}
                        targetId={targetId}
                        duration={0}
                        className="w-full"
                        onNavigate={() => setMobileMenuOpen(false)}
                      >
                        {label}
                      </TimedAnchorLink>
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuItem key={href} asChild className={itemClassName}>
                    <Link
                      href={href}
                      onMouseEnter={() => void preload?.().catch(() => undefined)}
                      onFocus={() => void preload?.().catch(() => undefined)}
                    >
                      {label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  );
}
