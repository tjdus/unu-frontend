"use client";

import { useEffect } from "react";
import { useHomeEntranceDone } from "./use-home-entrance-done";

/**
 * One stop per gesture on the way down the home page.
 *
 * Stops are each section's start, plus one per screen inside sections taller than the
 * viewport. Moving down into territory not seen yet, a wheel / trackpad / touch gesture —
 * however large — glides to the next stop and the rest of that gesture is swallowed.
 * Everything already passed (above the furthest point reached) scrolls freely, up and
 * down. Links and buttons that scroll programmatically are left alone.
 *
 * A section can move its stop with an inner [data-scroll-stop="<offset px>"] element (the
 * About deck lands its heading just below the top), and anything can hold scrolling
 * entirely with html[data-scroll-hold] (the deck while its cards play).
 */

const GLIDE_MS = 520;
const QUIET_MS = 200; // wheel silence that ends a gesture (momentum tail)
const MIN_LOCK_MS = 700;
const EDGE = 3;
const SWIPE_MIN = 24; // px of finger travel that counts as a swipe
const USER_INPUT_MS = 1200; // scrolling this soon after wheel/touch counts as the user's

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function computeStops(home: HTMLElement) {
  const viewport = window.innerHeight;
  const max = document.documentElement.scrollHeight - viewport;
  const stops: number[] = [];
  for (const element of Array.from(home.children)) {
    if (!(element instanceof HTMLElement) || element.hasAttribute("aria-hidden")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.height < 2) continue;
    const bottom = rect.top + window.scrollY + rect.height;
    const custom = element.querySelector<HTMLElement>("[data-scroll-stop]");
    const top = custom
      ? custom.getBoundingClientRect().top + window.scrollY - Number(custom.dataset.scrollStop || 0)
      : rect.top + window.scrollY;
    stops.push(top);
    // Tall sections: a stop per screen, the last one showing the section's end.
    for (let y = top + viewport; y < bottom - viewport; y += viewport) stops.push(y);
    if (rect.height > viewport * 1.1) stops.push(bottom - viewport);
  }
  stops.push(max);
  // Stops closer than a fifth of a screen make a pointless nudge: drop them (the page's
  // last stop wins over its neighbour).
  const minGap = viewport * 0.2;
  const sorted = Array.from(new Set(stops.map((y) => Math.round(Math.min(Math.max(0, y), max)))))
    .sort((a, b) => a - b);
  const result: number[] = [];
  for (const y of sorted) {
    const last = result[result.length - 1];
    if (last === undefined || y - last >= minGap) result.push(y);
    else if (y === Math.round(max)) result[result.length - 1] = y;
  }
  return result;
}

export function HomeScrollStops() {
  const entranceDone = useHomeEntranceDone();

  useEffect(() => {
    if (!entranceDone) return;
    const home = document.getElementById("home-top");
    if (!home || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let stops = computeStops(home);
    let frontier = window.scrollY; // furthest point reached
    let frame = 0;
    let glideTimer = 0;
    let gliding = false;
    let locked = false;
    let lockedUntil = 0;
    let lastWheel = 0;
    let lastUserInput = 0;
    let touch: { y: number; controlled: boolean } | null = null;

    const nextStop = (from: number) => stops.find((stop) => stop > from + EDGE);
    const held = () => document.documentElement.hasAttribute("data-scroll-hold");

    const glideTo = (target: number) => {
      cancelAnimationFrame(frame);
      frontier = Math.max(frontier, target);
      const start = window.scrollY;
      const distance = target - start;
      const startTime = performance.now();
      gliding = true;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / GLIDE_MS);
        window.scrollTo({ top: start + distance * easeInOutCubic(t), behavior: "instant" });
        if (t < 1) frame = requestAnimationFrame(step);
        else gliding = false;
      };
      frame = requestAnimationFrame(step);
      // If frames stall (tab hidden mid-glide), land anyway so input never stays locked.
      window.clearTimeout(glideTimer);
      glideTimer = window.setTimeout(() => {
        if (!gliding) return;
        cancelAnimationFrame(frame);
        window.scrollTo({ top: target, behavior: "instant" });
        gliding = false;
      }, GLIDE_MS + 150);
    };

    /**
     * Take one step down; true when the gesture is now ours. From ground already seen,
     * the step ends at the frontier (the furthest point reached) instead.
     */
    const stepDown = () => {
      const y = window.scrollY;
      const target = y < frontier - EDGE ? frontier : nextStop(y);
      if (target === undefined) return false;
      locked = true;
      lockedUntil = performance.now() + MIN_LOCK_MS;
      glideTo(target);
      return true;
    };

    // Moving down at (or past) the frontier is new territory.
    const atFrontier = () => window.scrollY >= frontier - EDGE;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // pinch-zoom
      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now;
      lastUserInput = now;

      if (held()) {
        // Something is playing: swallow input, and treat the rest of this gesture as spent.
        event.preventDefault();
        locked = true;
        lockedUntil = now;
        return;
      }

      if (locked) {
        if (gap < QUIET_MS || now < lockedUntil || gliding) {
          event.preventDefault();
          return;
        }
        locked = false;
      }

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = event.deltaY * unit;
      if (delta <= 0) return; // going up is always free
      if (!atFrontier() && window.scrollY + delta <= frontier) return; // inside seen ground
      if (stepDown()) event.preventDefault();
    };

    const onTouchStart = (event: TouchEvent) => {
      lastUserInput = performance.now();
      touch = event.touches.length === 1 ? { y: event.touches[0].clientY, controlled: false } : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      lastUserInput = performance.now();
      if (!touch || event.touches.length !== 1) return;
      if (locked || gliding || held()) {
        event.preventDefault();
        return;
      }
      const travel = touch.y - event.touches[0].clientY; // > 0: finger up = scroll down
      if (travel <= 0 || !atFrontier()) return;
      event.preventDefault();
      if (!touch.controlled && travel >= SWIPE_MIN) {
        touch.controlled = true;
        stepDown();
      }
    };

    const onTouchEnd = () => {
      touch = null;
      locked = false;
    };

    // Momentum or a fast native fling can still carry past the frontier: settle it back
    // onto the first new stop. Programmatic scrolls (links, buttons) just extend it.
    let settleTimer = 0;
    const onScroll = () => {
      if (gliding || held()) return;
      const y = window.scrollY;
      if (y <= frontier + EDGE) return;
      if (performance.now() - lastUserInput > USER_INPUT_MS) {
        frontier = y;
        return;
      }
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        const target = nextStop(frontier);
        if (target !== undefined && window.scrollY > target + EDGE) glideTo(target);
        else frontier = Math.max(frontier, window.scrollY);
      }, 90);
    };

    const relayout = () => {
      stops = computeStops(home);
    };
    const resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(home);

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", relayout);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(glideTimer);
      window.clearTimeout(settleTimer);
      resizeObserver.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", relayout);
    };
  }, [entranceDone]);

  return null;
}
