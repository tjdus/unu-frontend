"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AboutSectionInfo } from "@/lib/about-sections";
import styles from "@/app/about/about.module.css";

const ART_WIDTH = 652;
const ART_HEIGHT = 500;
const CENTER_X = 326;
const CENTER_Y = 248;
const RADIUS = 154;
const ART_PATH = "/about-dial";
const SCROLL_EDGE_TOLERANCE = 2;
const WHEEL_IDLE_MS = 110;
const STEP_DURATION_MS = 360;
const MAX_STEP_MS = 520;
const SETTLE_DELAY_MS = 140; // scroll pause after which an off-dot dial settles
const SWIPE_THRESHOLD = 20;
const LABEL_BOUNDS = [
  [326, 30, 92],
  [484, 98, 110],
  [551, 292, 120],
  [425, 440, 112],
  [228, 440, 122],
  [94, 292, 150],
  [153, 98, 174],
];

function pointOnDial(step: number) {
  const angle = (step / 28) * 2 * Math.PI - Math.PI / 2;
  // Keep SVG attributes identical on the server and in the browser.
  return [
    Number((CENTER_X + RADIUS * Math.cos(angle)).toFixed(3)),
    Number((CENTER_Y + RADIUS * Math.sin(angle)).toFixed(3)),
  ];
}

const GRADUATIONS = Array.from({ length: 28 }, (_, step) => step)
  .filter((step) => step % 4 !== 0)
  .map(pointOnDial);

function stageScrollRange(section: HTMLElement, stage: HTMLElement) {
  return {
    top: (Number.parseFloat(getComputedStyle(stage).top) || 0) -
      section.getBoundingClientRect().top,
    travel: Math.max(1, section.offsetHeight - stage.offsetHeight),
  };
}

function stepScrollY(
  index: number,
  lastIndex: number,
  { top, travel }: ReturnType<typeof stageScrollRange>,
) {
  return window.scrollY - top + (index / Math.max(1, lastIndex)) * travel;
}

function getStep(
  delta: number,
  { top, travel }: ReturnType<typeof stageScrollRange>,
  lastIndex: number,
) {
  const direction = Math.sign(delta);
  // Above the dial (the hero): any downward gesture goes straight to the first dot.
  if (top < -SCROLL_EDGE_TOLERANCE) {
    return direction > 0 ? 0 : null;
  }
  if (top > travel + SCROLL_EDGE_TOLERANCE) {
    return direction < 0 && top + delta <= travel ? lastIndex : null;
  }
  const index = Math.round(Math.min(1, Math.max(0, top / travel)) * lastIndex);
  // Past either end the step leaves the dial (-1: back to the hero, lastIndex + 1: on to
  // the next section), so a big flick never flies past it.
  return index + direction;
}

export function AboutActivityDial({ items }: { items: AboutSectionInfo[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const selectStep = useRef<((index: number) => void) | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIndex = items.length - 1;
  const stepAngle = 360 / items.length;

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    let active = 0;
    let wheelIdleAt = 0;
    let motion: { from: number; to: number; startedAt: number; duration: number } | null = null;
    let swipe: { x: number; y: number; consumed: boolean } | null = null;

    // Exit targets: the top of the page before the dial, the next section after it.
    const exitY = (index: number, range: ReturnType<typeof stageScrollRange>) => {
      if (index < 0) return 0;
      let target = section.nextElementSibling;
      while (target && target.tagName !== "SECTION") target = target.nextElementSibling;
      return target
        ? target.getBoundingClientRect().top + window.scrollY
        : stepScrollY(lastIndex, lastIndex, range) + window.innerHeight;
    };

    const hold = (on: boolean) => {
      if (on) document.documentElement.dataset.scrollHold = "";
      else delete document.documentElement.dataset.scrollHold;
    };

    const stepTo = (index: number, range: ReturnType<typeof stageScrollRange>) => {
      const from = window.scrollY;
      const to = index < 0 || index > lastIndex ? exitY(index, range) : stepScrollY(index, lastIndex, range);
      if (reducedMotion.matches || Math.abs(to - from) < 1) {
        motion = null;
        window.scrollTo({ top: to, behavior: "instant" });
      } else {
        const stepDistance = range.travel / Math.max(1, lastIndex);
        const extraSteps = Math.max(0, Math.abs(to - from) / stepDistance - 1);
        motion = { from, to, startedAt: performance.now(), duration: Math.min(MAX_STEP_MS, STEP_DURATION_MS + 40 * extraSteps) };
        hold(true);
      }
      schedule();
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.cancelable || event.ctrlKey || event.shiftKey ||
          !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const now = performance.now();
      if (motion || now < wheelIdleAt) {
        // Treat a trackpad burst and its momentum as a single gesture.
        wheelIdleAt = now + WHEEL_IDLE_MS;
        event.preventDefault();
        return;
      }

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = event.deltaY * unit;
      if (Math.abs(delta) < 2) return;
      // The dial always rests on a dot: every gesture in or into it is one step, either way.
      const range = stageScrollRange(section, stage);
      const next = getStep(delta, range, lastIndex);
      if (next === null) return;

      event.preventDefault();
      wheelIdleAt = now + WHEEL_IDLE_MS;
      stepTo(next, range);
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches.length === 1 ? event.touches[0] : null;
      swipe = touch ? { x: touch.clientX, y: touch.clientY, consumed: false } : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!swipe || !event.cancelable || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const delta = swipe.y - touch.clientY;
      if (swipe.consumed) {
        event.preventDefault();
        return;
      }
      if (Math.abs(delta) < 4 || Math.abs(touch.clientX - swipe.x) > Math.abs(delta)) return;

      const range = stageScrollRange(section, stage);
      const next = getStep(delta, range, lastIndex);
      if (next === null) return;

      event.preventDefault();
      if (Math.abs(delta) >= SWIPE_THRESHOLD) {
        swipe.consumed = true;
        if (!motion) stepTo(next, range);
      }
    };

    const cancelSwipe = () => {
      swipe = null;
      scheduleSettle();
    };

    const update = (now: number) => {
      frame = null;
      if (motion) {
        const progress = reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (now - motion.startedAt) / motion.duration));
        // Zero velocity and acceleration at both ends keeps each stop gentle.
        const eased = progress ** 3 * (progress * (6 * progress - 15) + 10);
        window.scrollTo({ top: motion.from + (motion.to - motion.from) * eased, behavior: "instant" });
        if (progress === 1) {
          motion = null;
          hold(false);
        }
      }
      const { top, travel } = stageScrollRange(section, stage);
      const position = Math.min(1, Math.max(0, top / travel)) * lastIndex;
      const index = Math.round(position);
      stage.style.setProperty("--dial-angle", `${(reducedMotion.matches ? index : position) * stepAngle}deg`);
      if (index !== active) {
        active = index;
        setActiveIndex(index);
      }
      if (motion) schedule();
      else scheduleSettle();
    };

    // Whatever left the dial between two dots (keyboard, scrollbar, a fling) settles onto
    // the nearest dot once scrolling pauses.
    let settleTimer = 0;
    const scheduleSettle = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (motion || swipe) return;
        const range = stageScrollRange(section, stage);
        if (range.top <= SCROLL_EDGE_TOLERANCE || range.top >= range.travel - SCROLL_EDGE_TOLERANCE) return;
        const position = (range.top / range.travel) * lastIndex;
        const nearest = Math.round(position);
        if (Math.abs(position - nearest) * (range.travel / Math.max(1, lastIndex)) > 1) {
          stepTo(nearest, range);
        }
      }, SETTLE_DELAY_MS);
    };

    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    const measure = () => {
      stage.style.setProperty("--stage-height", `${stage.offsetHeight}px`);
      schedule();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    selectStep.current = (index) => stepTo(index, stageScrollRange(section, stage));

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", cancelSwipe);
    window.addEventListener("touchcancel", cancelSwipe);
    reducedMotion.addEventListener("change", schedule);
    return () => {
      window.clearTimeout(settleTimer);
      hold(false);
      selectStep.current = null;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", cancelSwipe);
      window.removeEventListener("touchcancel", cancelSwipe);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, [lastIndex, stepAngle]);

  const selectItem = (index: number) => {
    if (activeIndex !== index) selectStep.current?.(index);
  };

  return (
    <section className={styles.dialSection} ref={sectionRef} aria-label="주요 활동 및 지원">
      <div ref={stageRef} className={styles.dialStage}>
        <div className={styles.dialLayout}>
          <div className={styles.dial}>
            <svg
              className={styles.dialArtwork}
              width={ART_WIDTH}
              height={ART_HEIGHT}
              viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}
              aria-hidden="true"
            >
              <image href={`${ART_PATH}/dial-track.svg`} x={CENTER_X - RADIUS} y={CENTER_Y - RADIUS} width={308} height={308} />
              {items.map(({ id }, index) => {
                const [x, y] = pointOnDial(index * 4);
                return (
                  <image
                    key={id}
                    href={`${ART_PATH}/select-marker${Math.max(1, index)}.svg`}
                    x={x - 18}
                    y={y - 18}
                    width={36}
                    height={36}
                  />
                );
              })}
              <g className={styles.dialRotor}>
                {GRADUATIONS.map(([x, y]) => (
                  <image key={x + ":" + y} href={`${ART_PATH}/minor-graduation1.svg`} x={x - 1.25} y={y - 1.25} width={2.5} height={2.5} />
                ))}
                <image href={`${ART_PATH}/select-marker.svg`} x={CENTER_X - 18} y={CENTER_Y - RADIUS - 18} width={36} height={36} />
              </g>
            </svg>

            <div role="group" aria-label="활동 및 지원 선택">
              {items.map((item, index) => {
                const [x, y, width] = LABEL_BOUNDS[index];
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={index === activeIndex}
                    className={styles.dialLabel}
                    style={{
                      "--label-x": `${(x / ART_WIDTH) * 100}%`,
                      "--label-y": `${(y / ART_HEIGHT) * 100}%`,
                      "--label-width": `${(width / ART_WIDTH) * 100}%`,
                    } as CSSProperties}
                    onClick={() => selectItem(index)}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.activityPanels}>
            {items.map((item, index) => (
              <article
                key={item.id}
                className={styles.activityPanel}
                aria-hidden={index !== activeIndex}
                inert={index !== activeIndex}
              >
                <p className={styles.activityCategory}>{item.groupTitle}</p>
                <h2>{item.title}</h2>
                <p className={styles.activityCopy}>{item.description}</p>
                <Link href={`/about/${item.slug}`} className={styles.activityLink}>
                  {item.caseTitle}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
