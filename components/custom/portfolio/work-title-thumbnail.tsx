import type { CSSProperties } from "react";
import styles from "./work-title-thumbnail.module.css";

/**
 * Generated Work thumbnail: about four letters of the title, starting a little in from the
 * left and running off the right edge (the crop), extruded into a solid 3D block, with the
 * CNU logo as a small 3D tile in the bottom-left corner. Each project gets its own
 * background colour, tilt and crop (seeded by its title).
 */

const LETTERS = 4;
const DEPTH = 14; // extrusion layers (px)

// Dark grounds that sit with the site's deep green; white letters read on all of them.
const GROUNDS = [
  { glow: "#2b8a5e", from: "#1c7451", to: "#10603f" }, // forest
  { glow: "#3a9a93", from: "#1f6f6c", to: "#134f52" }, // teal
  { glow: "#8aa35a", from: "#5d7a3a", to: "#41592a" }, // moss
  { glow: "#6f8fa8", from: "#3c5a72", to: "#263d50" }, // slate
  { glow: "#c7865a", from: "#9a5b3c", to: "#6e3d28" }, // clay
  { glow: "#6f8078", from: "#39463f", to: "#222b27" }, // charcoal
];

/** Rough advance width per character, in em, to size the word to the frame. */
function charWidth(char: string) {
  if (/[ㄱ-힝]/.test(char)) return 1; // Hangul
  if (/[MW]/.test(char)) return 0.9;
  if (/[A-Z]/.test(char)) return 0.76;
  if (/[0-9]/.test(char)) return 0.6;
  if (/[a-z]/.test(char)) return 0.55;
  if (/[+\-=#&@%]/.test(char)) return 0.62;
  return 0.5;
}

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return value >>> 0;
}

// Extrusion: stacked 1px offsets from light to darker green-grey, then a soft cast shadow.
const EXTRUSION = [
  ...Array.from({ length: DEPTH }, (_, index) => {
    const t = index / (DEPTH - 1);
    const shade = Math.round(214 - t * 64); // 214 → 150
    return `${index + 1}px ${index + 1}px 0 rgb(${shade - 10} ${shade + 4} ${shade - 6})`;
  }),
  `${DEPTH + 6}px ${DEPTH + 18}px 28px rgb(0 0 0 / 0.28)`,
].join(", ");

/** Class for the media frame that holds the thumbnail (transparent ground, no rim). */
export const workTitleThumbnailFrame = styles.frame;

export function WorkTitleThumbnail({
  title,
  index,
  className,
}: {
  title: string;
  /** Position in a list: rotates the background colour so neighbours always differ. */
  index?: number;
  className?: string;
}) {
  const letters = Array.from(title.replace(/\s+/g, "")).slice(0, LETTERS);
  const word = letters.join("") || "CNU";
  const ems = Math.max(1.6, letters.reduce((sum, char) => sum + charWidth(char), 0));
  const seed = hash(title);
  const pick = (shift: number, range: number) => ((seed >>> shift) % 1000) / 1000 * range;

  const ground = GROUNDS[(index ?? seed) % GROUNDS.length];

  const style = {
    "--ems": ems.toFixed(3),
    "--ground-glow": ground.glow,
    "--ground-from": ground.from,
    "--ground-to": ground.to,
    // Tilt (deg) and where the crop falls; small ranges keep it calm.
    "--rx": `${(14 + pick(0, 10)).toFixed(1)}deg`,
    "--ry": `${(-22 + pick(10, 14)).toFixed(1)}deg`,
    "--rz": `${(-4 + pick(20, 8)).toFixed(1)}deg`,
    // Left margin (fraction of the frame width) and a small vertical drift.
    "--inset": `${(14 + pick(5, 3)).toFixed(1)}cqw`,
    "--shift-y": `${(-14 + pick(15, 6)).toFixed(1)}%`, // sit above centre, clear of the logo
    "--extrusion": EXTRUSION,
  } as CSSProperties;

  return (
    <span className={`${styles.thumb} ${className ?? ""}`} style={style} aria-hidden="true">
      <span className={styles.word}>{word}</span>
      <span className={styles.logo}>
        <svg viewBox="0 0 70 70" aria-hidden="true">
          <rect width="70" height="70" rx="18" fill="#68c19a" />
          <path
            fill="#fff"
            d="M49.4 24.9C45.8 21.4 42 20 36.3 20C27.5 20 20.7 26.4 20.7 35.1C20.7 43.8 27.5 50 36.5 50C41.8 50 46 48.2 49.4 44.6L44.6 40.8C42.5 43.1 40.2 44.1 36.7 44.1C31.6 44.1 28.1 40.3 28.1 35.1C28.1 29.9 31.6 26 36.8 26C40 26 42.5 27.1 44.6 29.2Z"
          />
        </svg>
      </span>
    </span>
  );
}
