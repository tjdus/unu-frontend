"use client";

import { useEffect, useRef } from "react";
import styles from "./home-ethos.module.css";

const STATEMENT = ["Learn,", "Build,", "Share."];

const NOTES = [
  { label: "We do", text: "강의 · 스터디 · 프로젝트 · 멘토링" },
  { label: "For", text: "개발 경험이 많지 않더라도, 관심 있는 누구나" },
  { label: "Approach", text: "학회원이 직접 구성하고 운영하는 스터디" },
  { label: "How", text: "기획부터 개발, 배포까지 직접 경험하는 프로젝트" },
];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// Rises past its target and settles back: the "pop" of each letter.
function easeOutBack(value: number) {
  const t = clamp01(value);
  const c1 = 2.4;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function easeOutCubic(value: number) {
  return 1 - (1 - clamp01(value)) ** 3;
}

// Scroll window: starts once the section top is at 75% of the viewport height.
const START_AT = 0.75;
// Unpinned (small screens): the wave plays over this much scroll (fraction of the viewport).
const TRAVEL = 0.6;
// Large screens: the section is held ("brake") for this much scroll while the wave plays,
// so the next section does not slide in before the statement has finished.
const PIN_QUERY =
  "(min-width: 900px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)";
const HOLD = 0.9;
// Scroll thresholds (0–1 of the window) at which each unit fires.
const WORD_THRESHOLDS = [0.08, 0.22, 0.36];
// The last two notes fire on the same scroll step; MIN_GAP still staggers them.
const NOTE_THRESHOLDS = [0.42, 0.52, 0.62, 0.62];
// Time-based playback once a unit fires (seconds).
const WORD_DURATION = 0.75;
const CHAR_OFFSET = 0.045;
const NOTE_DURATION = 0.8;
// Minimum time gap between consecutive units, even on a fast scroll.
const MIN_GAP = 0.26;
const HIDE_SPEED = 1 / 0.35;

type Unit = { threshold: number; active: boolean; startAt: number };
type WaveItem = {
  element: HTMLElement;
  kind: "char" | "note";
  unit: Unit;
  group: Unit[];
  offset: number;
  duration: number;
  value: number;
};

/**
 * Word-by-word pop: scrolling past a threshold fires the next word (or note), which then
 * plays over a fixed time, so the pop stays visible however fast the page is scrolled.
 * Consecutive units are kept at least MIN_GAP apart; scrolling back up hides them again.
 * Layout is measured on resize only; scrolling reads scrollY and writes transform/opacity.
 */
function useScrollWave(
  sectionRef: React.RefObject<HTMLElement | null>,
  trackRef: React.RefObject<HTMLDivElement | null>,
  pinRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const pinned = pinRef.current;
    if (!section || !track || !pinned) return;
    const pin = window.matchMedia(PIN_QUERY);

    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const words: Unit[] = WORD_THRESHOLDS.map((threshold) => ({ threshold, active: false, startAt: 0 }));
    const noteUnits: Unit[] = NOTE_THRESHOLDS.map((threshold) => ({ threshold, active: false, startAt: 0 }));
    const items: WaveItem[] = [];
    section.querySelectorAll<HTMLElement>("[data-wave-word]").forEach((wordEl, wordIndex) => {
      wordEl.querySelectorAll<HTMLElement>("[data-wave-char]").forEach((element, charIndex) => {
        items.push({
          element,
          kind: "char",
          unit: words[wordIndex],
          group: words,
          offset: charIndex * CHAR_OFFSET,
          duration: WORD_DURATION,
          value: 0,
        });
      });
    });
    section.querySelectorAll<HTMLElement>("[data-wave-note]").forEach((element, index) => {
      items.push({
        element,
        kind: "note",
        unit: noteUnits[index],
        group: noteUnits,
        offset: 0,
        duration: NOTE_DURATION,
        value: 0,
      });
    });

    let start = 0;
    let travel = 1;
    let frame = 0;
    let lastTime = 0;

    const apply = (item: WaveItem) => {
      const v = item.value;
      if (item.kind === "char") {
        const pop = easeOutBack(v);
        item.element.style.transform =
          `translate3d(0, ${((1 - pop) * 0.55).toFixed(3)}em, 0) ` +
          `scale(${(0.3 + 0.7 * pop).toFixed(3)}) rotate(${((1 - pop) * -14).toFixed(2)}deg)`;
        item.element.style.opacity = clamp01(v * 3).toFixed(3);
      } else {
        const rise = easeOutCubic(v);
        item.element.style.transform = `translate3d(0, ${((1 - rise) * 56).toFixed(2)}px, 0)`;
        item.element.style.opacity = rise.toFixed(3);
      }
    };

    const measure = () => {
      section.toggleAttribute("data-wave", motion.matches);
      if (!motion.matches) {
        items.forEach((item) => {
          item.element.style.transform = "";
          item.element.style.opacity = "";
        });
        return;
      }
      const viewport = window.innerHeight;
      track.toggleAttribute("data-pin", pin.matches);
      track.style.height = "";
      pinned.style.top = "";

      if (pin.matches) {
        const pinHeight = pinned.offsetHeight;
        const hold = viewport * HOLD;
        const stickyTop = Math.max(24, (viewport - pinHeight) / 2);
        track.style.height = `${pinHeight + hold}px`;
        pinned.style.top = `${stickyTop}px`;
        const pinTop = track.getBoundingClientRect().top + window.scrollY;
        // From the section entering the screen until the hold releases.
        start = pinTop - viewport * START_AT;
        travel = pinTop - stickyTop + hold - start;
        return;
      }

      start = section.getBoundingClientRect().top + window.scrollY - viewport * START_AT;
      travel = viewport * TRAVEL;
    };

    // Fire / un-fire units from the scroll position (no DOM reads).
    const updateUnits = (now: number) => {
      const progress = (window.scrollY - start) / travel;
      for (const group of [words, noteUnits]) {
        group.forEach((unit, index) => {
          const shouldBeActive = progress >= unit.threshold;
          if (shouldBeActive && !unit.active) {
            const previous = group[index - 1];
            const earliest = previous?.active ? previous.startAt + MIN_GAP : now;
            unit.active = true;
            unit.startAt = Math.max(now, earliest);
          } else if (!shouldBeActive && unit.active) {
            unit.active = false;
          }
        });
      }
    };

    const tick = (timestamp: number) => {
      frame = 0;
      const now = timestamp / 1000;
      const dt = lastTime ? Math.min(0.05, now - lastTime) : 1 / 60;
      lastTime = now;
      updateUnits(now);

      let animating = false;
      items.forEach((item) => {
        let next: number;
        if (item.unit.active) {
          next = clamp01((now - item.unit.startAt - item.offset) / item.duration);
          if (next < 1) animating = true;
        } else {
          next = Math.max(0, item.value - dt * HIDE_SPEED);
          if (next > 0) animating = true;
        }
        if (next !== item.value) {
          item.value = next;
          apply(item);
        }
      });
      if (animating) frame = window.requestAnimationFrame(tick);
      else lastTime = 0;
    };

    const requestTick = () => {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const onScroll = () => {
      if (motion.matches) requestTick();
    };

    let relayoutFrame = 0;
    const relayout = () => {
      if (relayoutFrame) return;
      relayoutFrame = window.requestAnimationFrame(() => {
        relayoutFrame = 0;
        measure();
        if (motion.matches) requestTick();
      });
    };

    measure();
    if (motion.matches) {
      items.forEach(apply);
      requestTick();
    }

    const resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", relayout, { passive: true });
    motion.addEventListener("change", relayout);
    pin.addEventListener("change", relayout);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(relayoutFrame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", relayout);
      motion.removeEventListener("change", relayout);
      pin.removeEventListener("change", relayout);
    };
  }, [sectionRef, trackRef, pinRef]);
}

export function HomeEthos({ className }: { className?: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  useScrollWave(sectionRef, trackRef, pinRef);

  return (
    <section ref={sectionRef} aria-label="Our ethos" className={className}>
      <div ref={trackRef} className={styles.track}>
        <div ref={pinRef} className={`${styles.ethos} ${styles.pin}`}>
          <div>
            <p className={styles.statement} aria-label={STATEMENT.join(" ")}>
              {STATEMENT.map((word) => (
                <span key={word} data-wave-word className={styles.line} aria-hidden="true">
                  {Array.from(word).map((char, index) => (
                    <span key={`${word}-${index}`} data-wave-char className={styles.char}>
                      {char}
                    </span>
                  ))}
                </span>
              ))}
            </p>
          </div>

          <ul className={styles.notes}>
            {NOTES.map(({ label, text }) => (
              <li key={label} data-wave-note className={styles.note}>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
