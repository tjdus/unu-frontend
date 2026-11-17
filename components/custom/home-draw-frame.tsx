"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReplayInView } from "./use-replay-in-view";
import styles from "./home-draw-frame.module.css";

const RADIUS = 12;

/**
 * Two half-outlines of a rounded rectangle, both starting at the middle of the top-left
 * corner: A runs along the top and down the right side, B down the left side and along the
 * bottom. They have the same length, so drawn together they meet at the bottom-right corner.
 * Coordinates are in real pixels (the SVG viewBox follows the element size), which keeps the
 * 1px stroke crisp and the dash maths exact.
 */
function framePaths(width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const x0 = 0.5;
  const y0 = 0.5;
  const x1 = width - 0.5;
  const y1 = height - 0.5;
  const k = r * (1 - Math.SQRT1_2); // corner-arc midpoint offset
  const start = `M${x0 + k} ${y0 + k}`;
  const end = `${x1 - k} ${y1 - k}`;
  const a = [
    start,
    `A${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
    `H${x1 - r}`,
    `A${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `V${y1 - r}`,
    `A${r} ${r} 0 0 1 ${end}`,
  ].join("");
  const b = [
    start,
    `A${r} ${r} 0 0 0 ${x0} ${y0 + r}`,
    `V${y1 - r}`,
    `A${r} ${r} 0 0 0 ${x0 + r} ${y1}`,
    `H${x1 - r}`,
    `A${r} ${r} 0 0 0 ${end}`,
  ].join("");
  return [a, b];
}

/** Thin rounded frame that draws itself from the top-left corner when it scrolls into view. */
export function HomeDrawFrame({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useReplayInView(ref, 0.3);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
    });
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${styles.frame} ${className ?? ""}`}>
      {size && (
        <svg
          className={styles.stroke}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-hidden="true"
        >
          {framePaths(size.width, size.height, RADIUS).map((d, index) => (
            <path key={index} d={d} pathLength={1} />
          ))}
        </svg>
      )}
      {children}
    </div>
  );
}
