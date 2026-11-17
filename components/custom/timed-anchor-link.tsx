"use client";

import { MouseEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const PENDING_SCROLL_KEY = "cnu-pending-scroll";

interface TimedAnchorLinkProps {
  children: ReactNode;
  className?: string;
  duration?: number;
  href?: string;
  offset?: number;
  onNavigate?: () => void;
  targetId: string;
  /** Write `#targetId` to the URL (default). Off keeps reloads from skipping the home entrance. */
  updateHash?: boolean;
}

export function TimedAnchorLink({
  children,
  className,
  duration = 900,
  href,
  offset,
  onNavigate,
  targetId,
  updateHash = true,
}: TimedAnchorLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const animationFrame = useRef<number | null>(null);
  const preserveAnimationOnUnmount = useRef(false);

  useEffect(
    () => () => {
      if (
        animationFrame.current !== null &&
        !preserveAnimationOnUnmount.current
      ) {
        cancelAnimationFrame(animationFrame.current);
      }
    },
    [],
  );

  const scrollToTarget = useCallback((writeHash = updateHash) => {
    const target = document.getElementById(targetId);
    if (!target) return false;

    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
    }

    const startY = window.scrollY;
    const headerHeight =
      offset ?? document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const targetY = target.getBoundingClientRect().top + startY - headerHeight;
    const distance = targetY - startY;

    if (writeHash) window.history.pushState(null, "", `#${targetId}`);

    if (duration <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo({ top: targetY, behavior: "instant" });
      return true;
    }

    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      window.scrollTo({
        top: startY + distance * easedProgress,
        behavior: "instant",
      });

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        animationFrame.current = null;
      }
    };

    animationFrame.current = requestAnimationFrame(animate);
    return true;
  }, [duration, offset, targetId, updateHash]);

  useLayoutEffect(() => {
    if (sessionStorage.getItem(PENDING_SCROLL_KEY) !== targetId) return;

    const visitTarget = () => {
      if (scrollToTarget()) {
        sessionStorage.removeItem(PENDING_SCROLL_KEY);
      }
    };

    if (duration <= 0) {
      // The first layout can precede styles and streamed content above the anchor.
      scrollToTarget(false);
    }

    const frame = requestAnimationFrame(visitTarget);
    return () => cancelAnimationFrame(frame);
  }, [duration, pathname, scrollToTarget, targetId]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (scrollToTarget()) {
      preserveAnimationOnUnmount.current = Boolean(onNavigate);
      onNavigate?.();
      return;
    }

    if (href) {
      onNavigate?.();
      if (duration <= 0 && href.endsWith(`#${targetId}`)) {
        router.push(href, { scroll: false });
        return;
      }
      sessionStorage.setItem(PENDING_SCROLL_KEY, targetId);
      router.push(href.split("#")[0] || "/", { scroll: duration > 0 });
    }
  };

  return (
    <a
      href={href ?? `#${targetId}`}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
