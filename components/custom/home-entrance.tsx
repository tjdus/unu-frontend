"use client";

import { useEffect, useRef } from "react";
import { onHomeHeroReady } from "./home-hero-ready";
import styles from "./home-entrance.module.css";

export const HOME_ENTRANCE_COMPLETE = "home-entrance-complete";
const MIN_DRAW_MS = 500;
const LOGO_FINISH_MS = 140;
// The screen also waits for the hero's 3D scene to draw its first frame, but never longer
// than this (counted from the start of the page) — no WebGL / a very slow device still gets in.
const MAX_WAIT_MS = 3000;

export function HomeEntrance() {
  const screenRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const screen = screenRef.current;
    const home = screen?.closest<HTMLElement>("#home-top");
    if (!screen || !home) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let frame = 0;
    let releaseTimer: number | undefined;
    let finishTimer: number | undefined;
    let capTimer: number | undefined;
    let stopHeroWait = () => {};

    const finish = () => {
      if (disposed || screen.dataset.phase === "done") return;
      screen.dataset.phase = "done";
      home.dataset.homeEntranceComplete = "";
      screen.dispatchEvent(new Event(HOME_ENTRANCE_COMPLETE));
    };

    const hidden = () => {
      const style = getComputedStyle(screen);
      return style.display === "none" || style.visibility === "hidden";
    };

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.target === screen && hidden()) finish();
    };

    const release = () => {
      if (disposed || reduced.matches || screen.dataset.phase === "done") return;
      if (hidden()) {
        finish();
        return;
      }

      // Fit the remaining strokes and fill into the same short finishing window.
      for (const animation of logoRef.current?.getAnimations({ subtree: true }) ?? []) {
        const elapsed = animation.currentTime;
        const duration = animation.effect?.getComputedTiming().endTime;
        if (typeof elapsed !== "number" || typeof duration !== "number") continue;
        animation.updatePlaybackRate(Math.max(1, (duration - elapsed) / LOGO_FINISH_MS));
      }

      finishTimer = window.setTimeout(() => {
        if (screen.dataset.phase === "done") return;
        if (hidden()) finish();
        else if (Number(getComputedStyle(screen).opacity) >= 0.98) screen.dataset.phase = "leaving";
      }, LOGO_FINISH_MS);
    };

    // Time since the splash started, read once: its CSS leave timer is switched off below.
    const splashStart = screen.getAnimations()[0]?.currentTime;
    const mountedAt = performance.now();
    const splashElapsed = () =>
      (typeof splashStart === "number" ? splashStart : 0) + (performance.now() - mountedAt);

    const scheduleRelease = () => {
      if (disposed || reduced.matches || screen.dataset.phase === "done") return;
      const wait = Math.max(0, MIN_DRAW_MS - splashElapsed());
      if (wait > 0) releaseTimer = window.setTimeout(release, wait);
      else release();
    };

    const splashAnimations = screen.getAnimations();
    const alreadyDismissed = hidden() && splashAnimations.length > 0 &&
      splashAnimations.every((animation) => animation.playState === "finished");
    if (alreadyDismissed || document.documentElement.hasAttribute("data-public-swipe")) {
      finish();
      return;
    }

    screen.addEventListener("animationend", onAnimationEnd);
    home.addEventListener("focusin", finish);
    reduced.addEventListener("change", finish);
    window.addEventListener("hashchange", finish);

    // Without JS the CSS leave timer dismisses the screen on its own; with JS it waits for
    // the fonts and the hero's first 3D frame instead, so hold that timer.
    if (!reduced.matches && Number(getComputedStyle(screen).opacity) >= 0.98) {
      screen.dataset.phase = "waiting";
    }
    const heroReady = new Promise<void>((resolve) => {
      stopHeroWait = onHomeHeroReady(resolve);
      capTimer = window.setTimeout(resolve, Math.max(0, MAX_WAIT_MS - splashElapsed()));
    });
    const fontsReady = document.fonts.ready.then(() => undefined, () => undefined);
    frame = window.requestAnimationFrame(() => {
      void Promise.all([fontsReady, heroReady]).then(scheduleRelease);
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(releaseTimer);
      window.clearTimeout(finishTimer);
      window.clearTimeout(capTimer);
      stopHeroWait();
      screen.removeEventListener("animationend", onAnimationEnd);
      home.removeEventListener("focusin", finish);
      reduced.removeEventListener("change", finish);
      window.removeEventListener("hashchange", finish);
    };
  }, []);

  return (
    <div ref={screenRef} className={styles.screen} data-home-entrance aria-hidden="true">
      <svg ref={logoRef} className={styles.logo} width="112" height="112" viewBox="0 0 70 70">
        <defs>
          <mask id="home-entrance-c-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="70" height="70">
            <path
              className={styles.letterStroke}
              d="M48.8 28C45.6 24.5 41.9 22.8 36.4 22.8C29.2 22.8 24.3 28.1 24.3 35C24.3 42.3 29.4 47 36.5 47C42 47 45.8 45.3 49 42"
              fill="none"
              stroke="white"
              strokeWidth="13"
              strokeLinecap="round"
              pathLength="1"
            />
          </mask>
        </defs>
        <rect className={styles.logoFill} width="70" height="70" rx="18" fill="#68c19a" />
        <path
          className={styles.outline}
          d="M5.979 5.979C9.056 2.903 13.306 1 18 1H52C61.389 1 69 8.611 69 18V52C69 61.389 61.389 69 52 69H18C8.611 69 1 61.389 1 52V18C1 13.306 2.903 9.056 5.95 6.01"
          fill="none"
          stroke="#68c19a"
          strokeWidth="1.8"
          strokeLinecap="round"
          pathLength="1"
        />
        <g className={styles.letter}>
          <path
            mask="url(#home-entrance-c-mask)"
            fill="white"
            d="M49.4 24.9C45.8 21.4 42 20 36.3 20C27.5 20 20.7 26.4 20.7 35.1C20.7 43.8 27.5 50 36.5 50C41.8 50 46 48.2 49.4 44.6L44.6 40.8C42.5 43.1 40.2 44.1 36.7 44.1C31.6 44.1 28.1 40.3 28.1 35.1C28.1 29.9 31.6 26 36.8 26C40 26 42.5 27.1 44.6 29.2Z"
          />
        </g>
      </svg>
    </div>
  );
}
