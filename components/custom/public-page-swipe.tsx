"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const PUBLIC_PAGE_ORDER = ["", "about", "portfolio", "blog"];

function swipeDirection(from: string, to: string) {
  const fromIndex = PUBLIC_PAGE_ORDER.indexOf(from.split("/")[1]);
  const toIndex = PUBLIC_PAGE_ORDER.indexOf(to.split("/")[1]);
  return toIndex >= 0 && toIndex < fromIndex ? "backward" : "forward";
}

function isPublicPage(path: string) {
  if (path === "/" || path === "/login") return true;
  const [, group, slug, subpage] = path.split("/");
  return (group === "about" || group === "portfolio" || group === "blog") &&
    slug !== "create" && !subpage;
}

export function PublicPageSwipe({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const surface = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (pathname === previous || !isPublicPage(previous) || !isPublicPage(pathname)) return;

    const element = surface.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element?.animate || reducedMotion.matches) return;

    // Animate the committed page regardless of how Next.js got there.
    const root = document.documentElement;
    const direction = swipeDirection(previous, pathname);
    root.setAttribute("data-public-swipe", direction);
    const animation = element.animate(
      [
        { transform: direction === "backward" ? "translateX(-100%)" : "translateX(100%)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "cubic-bezier(.65, 0, .25, 1)", fill: "both" },
    );
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      animation.cancel();
      root.removeAttribute("data-public-swipe");
      reducedMotion.removeEventListener("change", stop);
    };
    reducedMotion.addEventListener("change", stop);
    void animation.finished.then(stop, stop);
    return stop;
  }, [pathname]);

  return <div ref={surface} className="min-h-screen flex flex-col">{children}</div>;
}
