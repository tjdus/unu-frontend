"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { pageLoadState, subscribePageLoad } from "./page-load-hold";
import logo from "./home-entrance.module.css";
import styles from "./page-loading-screen.module.css";

// No minimum time: the screen leaves as soon as the page is ready.
const QUIET_MS = 250; // no new holds for this long: everything on screen has checked in
const MAX_WAIT_MS = 3000; // never longer than this, whatever is still loading
const LOGO_FINISH_MS = 140;

// Pages that have already finished loading in this tab. Coming back to one (client-side
// navigation) its data and 3D are cached, so the screen is skipped. A full reload starts
// empty again, which also keeps the server render and hydration in agreement.
const readyPages = new Set<string>();
export const LOADING_ATTR = "data-page-loading";

/**
 * The home entrance screen (same logo drawing) for pages with WebGL: it stays up while the
 * page's data loads (`busy`) and while anything on screen holds the load (page-load-hold),
 * then fades. Without JS it leaves on its own after a few seconds.
 */
export function PageLoadingScreen({ busy = false }: { busy?: boolean }) {
  const pathname = usePathname();
  const [skip] = useState(() => typeof window !== "undefined" && readyPages.has(pathname));
  const screenRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const busyRef = useRef(busy);
  const checkRef = useRef<() => void>(() => undefined);

  // While the screen is up the page doesn't swipe in (PublicPageSwipe reads this). Layout
  // effects run child-first, so this is set before the layout decides on the swipe.
  useLayoutEffect(() => {
    if (skip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.setAttribute(LOADING_ATTR, "");
    return () => root.removeAttribute(LOADING_ATTR);
  }, [skip]);

  useEffect(() => {
    busyRef.current = busy;
    checkRef.current();
  }, [busy]);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const page = pathname;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      screen.dataset.phase = "done";
      return;
    }

    // Hydrated after the no-JS fallback already let the page in: stay out of the way.
    if (getComputedStyle(screen).visibility === "hidden") {
      screen.dataset.phase = "done";
      return;
    }

    const startedAt = performance.now();
    let fontsReady = false;
    let leaving = false;
    let timer = 0;
    screen.dataset.phase = "waiting";

    const leave = (ready: boolean) => {
      if (leaving) return;
      leaving = true;
      if (ready) readyPages.add(page);
      window.clearTimeout(timer);
      // Finish the remaining logo strokes quickly, then fade.
      for (const animation of logoRef.current?.getAnimations({ subtree: true }) ?? []) {
        const elapsed = animation.currentTime;
        const duration = animation.effect?.getComputedTiming().endTime;
        if (typeof elapsed !== "number" || typeof duration !== "number") continue;
        animation.updatePlaybackRate(Math.max(1, (duration - elapsed) / LOGO_FINISH_MS));
      }
      timer = window.setTimeout(() => {
        screen.dataset.phase = "leaving";
        document.documentElement.removeAttribute(LOADING_ATTR);
      }, LOGO_FINISH_MS);
    };

    const check = () => {
      if (leaving) return;
      const now = performance.now();
      if (now - startedAt >= MAX_WAIT_MS) return leave(false);
      const { pending, changedAt } = pageLoadState();
      const quietFor = now - Math.max(changedAt, startedAt);
      const wait = QUIET_MS - quietFor;
      if (fontsReady && !busyRef.current && pending === 0 && wait <= 0) return leave(true);
      // Re-check when the minimum / quiet time is up (or at the cap).
      window.clearTimeout(timer);
      timer = window.setTimeout(check, Math.max(16, Math.min(wait > 0 ? wait : QUIET_MS, MAX_WAIT_MS - (now - startedAt))));
    };
    checkRef.current = check;

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.target === screen && screen.dataset.phase === "leaving") screen.dataset.phase = "done";
    };
    screen.addEventListener("animationend", onAnimationEnd);
    const unsubscribe = subscribePageLoad(check);
    void document.fonts.ready.finally(() => {
      fontsReady = true;
      check();
    });
    check();

    return () => {
      leaving = true;
      checkRef.current = () => undefined;
      window.clearTimeout(timer);
      unsubscribe();
      screen.removeEventListener("animationend", onAnimationEnd);
    };
    // The screen shows once per page load; later pathname changes don't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (skip) return null;

  return (
    <div ref={screenRef} className={styles.screen} aria-hidden="true">
      <svg ref={logoRef} className={logo.logo} width="112" height="112" viewBox="0 0 70 70">
        <defs>
          <mask id="page-loading-c-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="70" height="70">
            <path
              className={logo.letterStroke}
              d="M48.8 28C45.6 24.5 41.9 22.8 36.4 22.8C29.2 22.8 24.3 28.1 24.3 35C24.3 42.3 29.4 47 36.5 47C42 47 45.8 45.3 49 42"
              fill="none"
              stroke="white"
              strokeWidth="13"
              strokeLinecap="round"
              pathLength="1"
            />
          </mask>
        </defs>
        <rect className={logo.logoFill} width="70" height="70" rx="18" fill="#68c19a" />
        <path
          className={logo.outline}
          d="M5.979 5.979C9.056 2.903 13.306 1 18 1H52C61.389 1 69 8.611 69 18V52C69 61.389 61.389 69 52 69H18C8.611 69 1 61.389 1 52V18C1 13.306 2.903 9.056 5.95 6.01"
          fill="none"
          stroke="#68c19a"
          strokeWidth="1.8"
          strokeLinecap="round"
          pathLength="1"
        />
        <g className={logo.letter}>
          <path
            mask="url(#page-loading-c-mask)"
            fill="white"
            d="M49.4 24.9C45.8 21.4 42 20 36.3 20C27.5 20 20.7 26.4 20.7 35.1C20.7 43.8 27.5 50 36.5 50C41.8 50 46 48.2 49.4 44.6L44.6 40.8C42.5 43.1 40.2 44.1 36.7 44.1C31.6 44.1 28.1 40.3 28.1 35.1C28.1 29.9 31.6 26 36.8 26C40 26 42.5 27.1 44.6 29.2Z"
          />
        </g>
      </svg>
    </div>
  );
}
