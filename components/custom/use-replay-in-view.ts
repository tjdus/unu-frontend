"use client";

import { useEffect, type RefObject } from "react";

/**
 * Replays CSS entrances when the element enters the observer area.
 * Reduced motion: shown once, no replay.
 */
export function useReplayInView(ref: RefObject<HTMLElement | null>, threshold = 0.15, rootMargin = "0px") {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.play = "";
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          element.dataset.play = "";
        } else if (!entry.isIntersecting) {
          delete element.dataset.play;
        }
      },
      { rootMargin, threshold: threshold === 0 ? 0 : [0, threshold] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold]);
}
