"use client";

import { useEffect, useRef } from "react";

// Fine bars that rise from the ruler around the pointer (3200 Kelvin style).
const BAR_GAP = 4; // px between bars
const SIGMA = 40; // px, width of the peak under the pointer
const MAX_HEIGHT = 40; // px, tallest bar at the pointer
const ZONE_ABOVE = 140; // px above the ruler line that still counts as hovering it
const ZONE_BELOW = 28; // px below the ruler line
const FOLLOW = 16; // 1/s, how quickly the peak follows the pointer
// Each bar eases on its own: it rises quickly and settles slowly, so moving the pointer
// leaves a tail of shrinking bars behind it instead of a fixed bell curve.
const RISE = 22; // 1/s
const FALL = 3.2; // 1/s

/**
 * Rendered inside the hero ruler. The hero text layer ignores pointer events, so this
 * listens on the window and only reacts while the pointer is near the ruler line.
 */
export function HomeRulerHover({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ruler = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ruler || !ctx) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let width = 0;
    let height = 0;
    let color = "#dcebd2";
    let bars = new Float32Array(0);
    let pointerX = 0;
    let peakX = 0;
    let active = false;
    let frame = 0;
    let lastTime = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      color = getComputedStyle(ruler).getPropertyValue("--deep-on").trim() || color;
      const next = new Float32Array(Math.floor(width / BAR_GAP) + 1);
      next.set(bars.subarray(0, Math.min(bars.length, next.length)));
      bars = next;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      for (let i = 0; i < bars.length; i += 1) {
        const h = bars[i];
        if (h < 0.6) continue;
        ctx.globalAlpha = Math.min(1, 0.3 + h / MAX_HEIGHT);
        ctx.fillRect(i * BAR_GAP, height - h, 1, h);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
      lastTime = now;
      peakX += (pointerX - peakX) * (1 - Math.exp(-FOLLOW * dt));
      const rise = 1 - Math.exp(-RISE * dt);
      const fall = 1 - Math.exp(-FALL * dt);
      const twoSigma2 = 2 * SIGMA * SIGMA;

      let alive = false;
      for (let i = 0; i < bars.length; i += 1) {
        let target = 0;
        if (active) {
          const d = i * BAR_GAP - peakX;
          target = MAX_HEIGHT * Math.exp(-(d * d) / twoSigma2);
        }
        const h = bars[i];
        const next = h + (target - h) * (target > h ? rise : fall);
        bars[i] = next < 0.3 && target < 0.3 ? 0 : next;
        if (Math.abs(bars[i] - target) > 0.3) alive = true;
      }
      draw();

      if (alive || (active && Math.abs(pointerX - peakX) > 0.3)) {
        frame = window.requestAnimationFrame(tick);
      } else {
        lastTime = 0;
      }
    };

    const start = () => {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = ruler.getBoundingClientRect();
      const line = rect.bottom;
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= line - ZONE_ABOVE &&
        event.clientY <= line + ZONE_BELOW;
      const x = event.clientX - rect.left;
      // Entering the ruler starts the peak at the pointer instead of sliding in.
      if (inside && !active) peakX = x;
      pointerX = x;
      if (inside !== active || inside) {
        active = inside;
        start();
      }
    };

    const onLeave = () => {
      active = false;
      start();
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
