"use client";

import { useEffect, useRef } from "react";
import { useHomeEntranceDone } from "./use-home-entrance-done";
import styles from "./home-hero-title.module.css";

// Lusion "about" wordmark (AboutWhoLogo shader), rebuilt on a 2D canvas. The word is
// drawn once offscreen, then copied back one pixel column at a time so every column
// can follow the shader's per-vertex maths — smooth curves, no stepped slices:
//   ratio(x, y) = easeOutBack(clamp(show * 2.2 - x - 0.2 * y))
//   offset      = (1 - ratio) * (height + min(height * 1.1, 100px))   (pushed below)
// x runs 0→1 across the word and y 0→1 from the glyph bottom to its top, so a column's
// top trails its bottom and the letters squash and stretch as they rise. `show` goes
// 0→1 in one second; leaving the top of the page plays the same wave back over a
// second (Lusion's hideRatio).
const SHOW_SECONDS = 1;
const HIDE_SECONDS = 1;
const HIDE_SCROLL = 0.05; // viewport heights scrolled before the wordmark hides
const PAD = 0.35; // extra room above/below the line box for glyph overflow (× height)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// cubicBezier(0, 1.3, 1.1, 1, t) exactly as the shader evaluates it
function easeOutBack(t: number) {
  const c = 1.3 * 3;
  const b = (1.1 - 1.3) * 3 - c;
  const a = 1 - c - b;
  return a * t * t * t + b * t * t + c * t;
}

export function HomeHeroTitle({ text }: { text: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const entranceDone = useHomeEntranceDone();

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx || !entranceDone) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const source = document.createElement("canvas");
    const sctx = source.getContext("2d");
    if (!sctx) return;

    let width = 0; // css px of the line box
    let height = 0;
    let pad = 0;
    let below = 0; // room under the box for the rise (css px)
    let dpr = 1;
    let show = reduced ? 1 : 0;
    let hide = 0;
    let last = 0;
    let frame = 0;
    let visible = true;
    let disposed = false;

    // Draw the word once, matching the DOM text (font, colour, baseline).
    const layout = () => {
      const style = getComputedStyle(root);
      width = root.offsetWidth;
      height = root.offsetHeight;
      pad = Math.ceil(height * PAD);
      below = Math.ceil(height + Math.min(height * 1.1, 100));
      dpr = Math.min(2, window.devicePixelRatio || 1);

      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const sourceH = height + pad * 2;
      source.width = Math.ceil(width * dpr);
      source.height = Math.ceil(sourceH * dpr);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, width, sourceH);
      sctx.font = font;
      sctx.fillStyle = style.color;
      sctx.textBaseline = "alphabetic";
      const metrics = sctx.measureText(text);
      const ascent = metrics.fontBoundingBoxAscent;
      const descent = metrics.fontBoundingBoxDescent;
      const lineHeight = Number.parseFloat(style.lineHeight) || height;
      // Same baseline as the inline box: half-leading above the font's content area.
      const baseline = (lineHeight - (ascent + descent)) / 2 + ascent;
      sctx.fillText(text, 0, pad + baseline);

      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil((pad + height + below) * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${pad + height + below}px`;
      canvas.style.top = `${-pad}px`;
    };

    const render = () => {
      // Lusion: on mobile layouts showRatio *= 1 - hideRatio — the same wave in reverse.
      const ratio = show * (1 - hide);
      const offset = height + Math.min(height * 1.1, 100);
      const sourceH = height + pad * 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const columns = source.width;
      const glyphBottom = (pad + height) * dpr; // y of the line-box bottom in the canvas
      for (let col = 0; col < columns; col += 1) {
        const x = (col + 0.5) / columns;
        const bottom = (1 - easeOutBack(clamp01(ratio * 2.2 - x))) * offset;
        const top = (1 - easeOutBack(clamp01(ratio * 2.2 - x - 0.2))) * offset;
        // Anchor the column at the line-box bottom; stretch so its top follows `top`.
        const scale = height > 0 ? Math.max(0, 1 - (top - bottom) / height) : 1;
        const destH = sourceH * dpr * scale;
        const destBottom = glyphBottom + bottom * dpr + pad * dpr * scale;
        if (destBottom - destH > canvas.height || destH < 0.5) continue;
        ctx.drawImage(source, col, 0, 1, source.height, col, destBottom - destH, 1, destH);
      }
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const hideTarget = !reduced && window.scrollY > window.innerHeight * HIDE_SCROLL ? 1 : 0;
      show = Math.min(1, show + dt / SHOW_SECONDS);
      hide = hideTarget ? Math.min(1, hide + dt / HIDE_SECONDS) : Math.max(0, hide - dt / HIDE_SECONDS);
      render();
      const settled = show >= 1 && hide === hideTarget;
      if (!settled && visible) frame = requestAnimationFrame(tick);
      else last = 0;
    };

    const request = () => {
      if (!frame && visible && !disposed) frame = requestAnimationFrame(tick);
    };

    const resize = new ResizeObserver(() => {
      layout();
      render();
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) request();
    });

    // Wait for the web font so the canvas glyphs match the page.
    document.fonts.ready.then(() => {
      if (disposed) return;
      layout();
      render();
      root.dataset.ready = "";
      resize.observe(root);
      observer.observe(root);
      if (!reduced) window.addEventListener("scroll", request, { passive: true });
      request();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      window.removeEventListener("scroll", request);
    };
  }, [entranceDone, text]);

  return (
    <span ref={rootRef} className={styles.title}>
      <span className="sr-only">{text}</span>
      {/* Invisible copy keeps the h1's size; the canvas draws the word over it. */}
      <span aria-hidden="true" className={styles.sizer}>
        {text}
      </span>
      <canvas ref={canvasRef} aria-hidden="true" className={styles.canvas} />
    </span>
  );
}
