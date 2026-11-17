"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./home-about.module.css";

const DESCRIPTION_LINES = [
  "웹과 시스템을 함께 배우고,",
  "아이디어를 실제 서비스로 만드는",
  "서강대학교 컴퓨터공학과 학회입니다.",
];

/**
 * Lusion "Area of Expertise" entrance, replayed every time the heading enters the viewport:
 * line-1 words rise from below (0.1 s apart), the line-2 word drops in from above at the
 * left edge and then slides into its indent, and the description lines rise one by one.
 * The choreography itself lives in CSS (home-about.module.css); this only toggles it.
 */
function useIntroReveal(introRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    intro.dataset.reveal = "ready";
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Reset when it leaves the screen so it plays again on the way back, like Lusion.
        intro.dataset.reveal = entry.isIntersecting ? "play" : "ready";
      },
      { threshold: 0.15 },
    );
    observer.observe(intro);
    return () => observer.disconnect();
  }, [introRef]);
}

// Items are taken from the activity descriptions on /about.
const AREAS = [
  {
    title: "Study",
    items: ["학회원 주도 스터디", "웹 · 시스템 강의", "정기 학습", "자료 공유"],
  },
  {
    title: "Projects",
    items: ["팀 프로젝트", "개인 프로젝트", "기획부터 배포까지", "개발 비용 지원"],
  },
  {
    title: "Community",
    items: ["멘토링", "현업 개발자 네트워킹", "커리어 정보 공유", "MT · 개/종강총회"],
  },
] as const;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// Smooth ease-in-out for the flip and the spread.
function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

const PIN_QUERY =
  "(min-width: 900px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)";
// Gap between the top of the viewport and the deck's header when it is in view.
const PIN_TOP = 32;
// One gesture plays the whole deck: spread + staggered flips, then the float settles in.
// Scrolling is held (html[data-scroll-hold]) until it has.
const PLAY_MS = 2200;
const HOLD_AFTER_MS = 700;
// Exponential smoothing rate (1/s). Time-based, so it behaves the same at 60 or 120 Hz.
const SMOOTHING = 14;
// Idle float after the flip: vertical drift (px) and how fast it fades in/out (1/s).
const FLOAT_LIFT = 10;
const FLOAT_EASE = 2.5;

type CardPose = { x: number; y: number; tilt: number; flip: number };
const POSE_KEYS: (keyof CardPose)[] = ["x", "y", "tilt", "flip"];

type Geometry =
  | { mode: "off" }
  | { mode: "pin"; start: number; spacing: number }
  | { mode: "flow"; cardTops: number[]; viewport: number };

/**
 * Lusion-style deck. On large screens the deck is one screen: the cards wait gathered in
 * the middle, face down, and when a scroll gesture lands on the deck (it is a scroll stop,
 * see HomeScrollStops) they spread out to their slots while turning over one after
 * another, then start floating — all in one go, with scrolling held meanwhile. It plays
 * once; afterwards the cards stay face up. Elsewhere each card turns over as it rises.
 *
 * Performance: layout is measured only on resize / content-size changes. Scrolling just
 * reads window.scrollY and writes `transform` on two elements per card (no layout reads,
 * no inherited custom properties), smoothed per frame with a time-based easing.
 */
function useScrollFlip(
  trackRef: React.RefObject<HTMLDivElement | null>,
  pinRef: React.RefObject<HTMLDivElement | null>,
  listRef: React.RefObject<HTMLUListElement | null>,
) {
  useEffect(() => {
    const track = trackRef.current;
    const pinned = pinRef.current;
    const list = listRef.current;
    if (!track || !pinned || !list) return;

    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const pin = window.matchMedia(PIN_QUERY);
    const slots = Array.from(list.querySelectorAll<HTMLElement>("[data-flip-card]"));
    const flippers = slots.map((slot) => slot.querySelector<HTMLElement>("[data-flipper]"));
    const middle = (slots.length - 1) / 2;
    const current: CardPose[] = slots.map(() => ({ x: 0, y: 0, tilt: 0, flip: 180 }));
    let targets: CardPose[] = current.map((pose) => ({ ...pose }));
    let geometry: Geometry = { mode: "off" };
    let frame = 0;
    let lastTime = 0;
    let snap = true;
    // Lusion-style idle float once a card has turned face up (0 = still, 1 = floating).
    const floatAmp = slots.map(() => 0);
    let visible = true;
    // Deck playback (pin mode): 0 until a gesture lands on it, then time-driven to 1.
    let playStart = 0;
    let holdTimer = 0;
    const playProgress = (now: number) => (playStart ? clamp01((now - playStart) / PLAY_MS) : 0);

    const releaseHold = () => {
      window.clearTimeout(holdTimer);
      delete document.documentElement.dataset.scrollHold;
    };

    const write = (now: number) => {
      const t = now / 1000;
      slots.forEach((slot, index) => {
        const { x, y, tilt, flip } = current[index];
        const a = floatAmp[index];
        const phase = index * 1.9;
        const fy = a * FLOAT_LIFT * Math.sin(t * 1.15 + phase);
        const fTilt = a * 0.9 * Math.sin(t * 0.8 + phase * 1.3);
        const fRotX = a * 4 * Math.sin(t * 0.95 + phase * 0.7);
        const fRotY = a * 5 * Math.sin(t * 0.7 + phase);
        slot.style.transform = `translate3d(${x.toFixed(2)}px, ${(y + fy).toFixed(2)}px, 0) rotate(${(tilt + fTilt).toFixed(3)}deg)`;
        const flipper = flippers[index];
        if (flipper) {
          flipper.style.transform = `rotateX(${fRotX.toFixed(2)}deg) rotateY(${(flip + fRotY).toFixed(2)}deg)`;
        }
      });
    };

    const clearInline = () => {
      track.style.height = "";
      track.removeAttribute("data-scroll-stop");
      pinned.style.top = "";
      list.style.transform = "";
      list.style.marginBottom = "";
    };

    // Reads and writes layout. Only runs on init, resize and content-size changes.
    const measureLayout = () => {
      list.toggleAttribute("data-flip-motion", motion.matches);
      track.toggleAttribute("data-deck-pin", pin.matches);
      clearInline();

      if (!motion.matches) {
        geometry = { mode: "off" };
        slots.forEach((slot, index) => {
          slot.style.transform = "";
          const flipper = flippers[index];
          if (flipper) flipper.style.transform = "";
        });
        return;
      }

      const viewport = window.innerHeight;
      if (pin.matches) {
        const listHeight = list.offsetHeight;
        const headerHeight = pinned.offsetHeight - listHeight;
        const available = viewport - PIN_TOP * 2 - headerHeight;
        const fit = Math.min(1, Math.max(0.5, available / listHeight));
        if (fit < 1) {
          list.style.transform = `scale(${fit})`;
          list.style.marginBottom = `${-listHeight * (1 - fit)}px`;
        }
        track.style.height = `${headerHeight + listHeight * fit}px`;
        // The scroll stop lands with the heading PIN_TOP below the top of the screen.
        track.setAttribute("data-scroll-stop", String(PIN_TOP));
        geometry = {
          mode: "pin",
          start: track.getBoundingClientRect().top + window.scrollY - PIN_TOP,
          spacing: slots.length > 1 ? slots[1].offsetLeft - slots[0].offsetLeft : 0,
        };
        return;
      }

      geometry = {
        mode: "flow",
        viewport,
        cardTops: slots.map((slot) => slot.getBoundingClientRect().top + window.scrollY),
      };
    };

    // Pure maths from scrollY + cached geometry: no DOM reads.
    const computeTargets = (now = performance.now()) => {
      const scrollY = window.scrollY;
      if (geometry.mode === "pin") {
        const { spacing } = geometry;
        const progress = playProgress(now);
        // Spread over 0.04–0.5, flips staggered between 0.18 and 0.9.
        const spread = easeInOutCubic((progress - 0.04) / 0.46);
        targets = slots.map((_, index) => {
          const side = index - middle;
          const flip = easeInOutCubic((progress - 0.18 - index * 0.1) / 0.5);
          return {
            x: -side * spacing * (1 - spread),
            y: Math.abs(side) * 18 * (1 - spread),
            tilt: side * 7 * (1 - spread),
            flip: 180 * (1 - flip),
          };
        });
      } else if (geometry.mode === "flow") {
        const { cardTops, viewport } = geometry;
        targets = cardTops.map((cardTop) => {
          const top = cardTop - scrollY;
          const raw = (viewport * 0.9 - top) / (viewport * 0.75);
          return { x: 0, y: 0, tilt: 0, flip: 180 * (1 - easeInOutCubic((raw - 0.3) / 0.7)) };
        });
      }
    };

    const tick = (now: number) => {
      frame = 0;
      if (geometry.mode === "off") return;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
      lastTime = now;
      const blend = snap ? 1 : 1 - Math.exp(-SMOOTHING * dt);
      snap = false;

      let moving = false;
      if (geometry.mode === "pin" && playStart && playProgress(now) < 1) {
        computeTargets(now);
        moving = true;
      }
      const floatBlend = 1 - Math.exp(-FLOAT_EASE * dt);
      current.forEach((pose, index) => {
        const target = targets[index];
        for (const key of POSE_KEYS) {
          const next = pose[key] + (target[key] - pose[key]) * blend;
          if (Math.abs(target[key] - next) < 0.01) {
            pose[key] = target[key];
          } else {
            pose[key] = next;
            moving = true;
          }
        }
        // Float only once the card has (nearly) finished turning face up.
        const floatTarget = target.flip < 1 && pose.flip < 6 ? 1 : 0;
        const amp = floatAmp[index] + (floatTarget - floatAmp[index]) * floatBlend;
        floatAmp[index] = Math.abs(floatTarget - amp) < 0.001 ? floatTarget : amp;
        if (floatAmp[index] > 0 || floatTarget > 0) moving = true;
      });
      write(now);
      if (moving && visible) frame = window.requestAnimationFrame(tick);
      else lastTime = 0;
    };

    const requestTick = () => {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    // Start the deck when the page reaches it (normally a scroll-stop glide landing on it).
    const maybePlay = () => {
      if (geometry.mode !== "pin" || playStart) return;
      const scrollY = window.scrollY;
      if (scrollY < geometry.start - 4) return;
      playStart = performance.now();
      // Hold scrolling only when the deck is what is on screen (not when jumped past).
      if (Math.abs(scrollY - geometry.start) < 48) {
        document.documentElement.dataset.scrollHold = "";
        holdTimer = window.setTimeout(releaseHold, PLAY_MS + HOLD_AFTER_MS);
      }
    };

    const onScroll = () => {
      if (geometry.mode === "off") return;
      maybePlay();
      computeTargets();
      requestTick();
    };

    let relayoutFrame = 0;
    const relayout = () => {
      if (relayoutFrame) return;
      relayoutFrame = window.requestAnimationFrame(() => {
        relayoutFrame = 0;
        measureLayout();
        maybePlay();
        computeTargets();
        requestTick();
      });
    };

    measureLayout();
    maybePlay();
    computeTargets();
    requestTick();

    // Content above (fonts, news list) can change height after load: re-measure then.
    const resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(document.body);

    // The float loop runs only while the deck is on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        lastTime = 0;
        requestTick();
      }
    });
    visibility.observe(track);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", relayout, { passive: true });
    motion.addEventListener("change", relayout);
    pin.addEventListener("change", relayout);
    return () => {
      releaseHold();
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(relayoutFrame);
      resizeObserver.disconnect();
      visibility.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", relayout);
      motion.removeEventListener("change", relayout);
      pin.removeEventListener("change", relayout);
    };
  }, [trackRef, pinRef, listRef]);
}

/** CNU app logo (same mark as the entrance animation / favicon). */
function CnuLogo() {
  return (
    <svg viewBox="0 0 70 70" width="88" height="88" aria-hidden="true">
      <rect width="70" height="70" rx="18" fill="#68c19a" />
      <path
        fill="#fff"
        d="M49.4 24.9C45.8 21.4 42 20 36.3 20C27.5 20 20.7 26.4 20.7 35.1C20.7 43.8 27.5 50 36.5 50C41.8 50 46 48.2 49.4 44.6L44.6 40.8C42.5 43.1 40.2 44.1 36.7 44.1C31.6 44.1 28.1 40.3 28.1 35.1C28.1 29.9 31.6 26 36.8 26C40 26 42.5 27.1 44.6 29.2Z"
      />
    </svg>
  );
}

export function HomeAbout() {
  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  useIntroReveal(introRef);
  const listRef = useRef<HTMLUListElement>(null);
  useScrollFlip(trackRef, pinRef, listRef);

  return (
    <section className={styles.about} aria-labelledby="home-about-heading">
      <div ref={trackRef} className={styles.deckTrack}>
        <div ref={pinRef} className={styles.pin}>
          <div ref={introRef} className={styles.intro}>
            <h2 id="home-about-heading" className={styles.title} aria-label="About us">
              <span className={styles.titleLine} aria-hidden="true">
                <span className={styles.word} style={{ "--i": 0 } as CSSProperties}>
                  About
                </span>
              </span>
              <span className={`${styles.titleLine} ${styles.titleLine2}`} aria-hidden="true">
                <span className={styles.shift} style={{ "--i": 1 } as CSSProperties}>
                  <span className={`${styles.word} ${styles.wordDrop}`}>us</span>
                </span>
              </span>
            </h2>
            <p className={styles.description}>
              {DESCRIPTION_LINES.map((line, index) => (
                <span key={line} className={styles.descLine}>
                  <span className={styles.descInner} style={{ "--i": index } as CSSProperties}>
                    {line}
                  </span>
                </span>
              ))}
            </p>
          </div>

          <ul ref={listRef} className={styles.cards}>
            {AREAS.map(({ title, items }) => (
              <li key={title} data-flip-card className={styles.slot}>
                <div data-flipper className={styles.flipper}>
                  <article className={`${styles.face} ${styles.front}`}>
                    <h3 className={styles.cardTitle}>{title}</h3>
                    <ul className={styles.list}>
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <p className={`${styles.cardTitle} ${styles.flipped}`} aria-hidden="true">
                      {title}
                    </p>
                  </article>
                  <div className={`${styles.face} ${styles.back}`} aria-hidden="true">
                    <div className={styles.backPanel}>
                      <span className={`${styles.backCorner} ${styles.cornerTL}`} />
                      <span className={`${styles.backCorner} ${styles.cornerTR}`} />
                      <span className={`${styles.backCorner} ${styles.cornerBL}`} />
                      <span className={`${styles.backCorner} ${styles.cornerBR}`} />
                      <span className={styles.backEmblem}>
                        <CnuLogo />
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
