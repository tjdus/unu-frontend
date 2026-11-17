"use client";

import { useEffect, useRef } from "react";
import styles from "./home-scroll-divider.module.css";

const FOLLOW_TIME_MS = 110;
const SETTLE_DISTANCE = 0.0005;

export function HomeScrollDivider() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const divider = ref.current;
    if (!divider) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    let lastTime: number | null = null;
    let needsMeasure = false;

    const readProgress = () => {
      if (reducedMotion.matches) return 1;
      const { top } = divider.getBoundingClientRect();
      const from = window.innerHeight * 0.94;
      const to = window.innerHeight * 0.28;
      return Math.min(1, Math.max(0, (from - top) / Math.max(1, from - to)));
    };

    let target = readProgress();
    let current = target;
    divider.style.setProperty("--divider-progress", String(current));

    const update = (now: number) => {
      frame = null;
      if (needsMeasure) {
        target = readProgress();
        needsMeasure = false;
      }

      const elapsed = lastTime === null ? 1000 / 60 : now - lastTime;
      const remaining = (target - current) * Math.exp(-elapsed / FOLLOW_TIME_MS);
      const next = reducedMotion.matches || Math.abs(remaining) < SETTLE_DISTANCE
        ? target
        : target - remaining;

      if (next !== current) {
        current = next;
        divider.style.setProperty("--divider-progress", String(current));
      }

      if (current !== target) {
        lastTime = now;
        frame = window.requestAnimationFrame(update);
      } else {
        lastTime = null;
      }
    };

    const schedule = () => {
      needsMeasure = true;
      if (frame === null) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    reducedMotion.addEventListener("change", schedule);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div className={styles.divider} aria-hidden="true">
      <div ref={ref} className={styles.markers}>
        <span className={styles.left} />
        <span className={styles.right} />
      </div>
    </div>
  );
}
