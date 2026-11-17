"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { EditorialBlogRow } from "@/components/custom/editorial";
import styles from "@/components/custom/editorial.module.css";
import type { BlogPost } from "@/lib/interfaces/blog";

const BEND = 0.1;
const SCROLL_DURATION = 1000;
let displacementTexture: string | undefined;

function getDisplacementTexture() {
  if (displacementTexture) return displacementTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixels = context.createImageData(size, size);
  // Encode the inverse radial lookup in red (x) and green (y), centered at 128.
  for (let row = 0; row < size; row++) {
    const y = (row + 0.5) / size * 2 - 1;
    for (let column = 0; column < size; column++) {
      const x = (column + 0.5) / size * 2 - 1;
      const radiusSquared = x * x + y * y;
      const offset = (row * size + column) * 4;
      pixels.data[offset] = (0.5 - x * radiusSquared / 4) * 255;
      pixels.data[offset + 1] = (0.5 - y * radiusSquared / 4) * 255;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  displacementTexture = canvas.toDataURL();
  return displacementTexture;
}

function attribute(element: Element, key: string, value: number | string) {
  const next = String(value);
  if (element.getAttribute(key) !== next) element.setAttribute(key, next);
}

export function BlogScrollWarp({ posts }: { posts: BlogPost[] }) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = list.current;
    const texture = getDisplacementTexture();
    if (!root || !texture) return;
    const rows = [...root.children].flatMap((row) => {
      const media = row.querySelector<HTMLElement>(`.${styles.media}`);
      const map = row.querySelector("feImage");
      const red = row.querySelector("feFuncR");
      const green = row.querySelector("feFuncG");
      const displacement = row.querySelector("feDisplacementMap");
      if (!media || !map || !red || !green || !displacement) return [];
      attribute(map, "href", texture);
      return [{ row, media, map, red, green, displacement }];
    });
    const disabled = window.matchMedia("(prefers-reduced-motion: reduce), (hover: none) and (pointer: coarse)");
    let frame = 0;
    let lastTime = 0;
    let lastScroll = window.scrollY;
    let strength = 0;
    let glide: { from: number; to: number; start: number } | null = null;

    const draw = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const axis = Math.max(width, height);
      const bounds = strength ? rows.map(({ media }) => media.getBoundingClientRect()) : [];
      rows.forEach(({ row, map, red, green, displacement }, index) => {
        const rect = bounds[index];
        const visible = !!rect && rect.bottom > 0 && rect.top < height;
        if (visible) {
          // Each image samples the same viewport-sized field, not its own center.
          attribute(map, "x", -rect.left);
          attribute(map, "y", -rect.top);
          attribute(map, "width", width);
          attribute(map, "height", height);
          attribute(red, "slope", width / axis);
          attribute(red, "intercept", (1 - width / axis) / 2);
          attribute(green, "slope", height / axis);
          attribute(green, "intercept", (1 - height / axis) / 2);
          attribute(displacement, "scale", (2 * BEND * axis * strength).toFixed(3));
        }
        row.toggleAttribute("data-warping", visible);
      });
    };

    const update = (now: number) => {
      frame = 0;
      const elapsed = lastTime ? Math.max(1, Math.min(50, now - lastTime)) : 1000 / 60;
      lastTime = now;
      if (disabled.matches) {
        glide = null;
        strength = 0;
      } else {
        if (glide && Math.abs(window.scrollY - lastScroll) > 2) glide = null;
        if (glide) {
          const t = Math.min(1, Math.max(0, (now - glide.start) / SCROLL_DURATION));
          const progress = Math.min(1, 1.001 - 2 ** (-10 * t));
          window.scrollTo({ top: glide.from + (glide.to - glide.from) * progress, behavior: "instant" });
          if (progress === 1) glide = null;
        }
        const speed = Math.min(1, Math.abs(window.scrollY - lastScroll) * (1000 / 60) / (elapsed * 100));
        strength += (speed - strength) * (1 - Math.exp(-5 * elapsed / 1000));
        if (!glide && !speed && strength < 0.002) strength = 0;
      }
      lastScroll = window.scrollY;
      draw();
      if (glide || strength) schedule();
      else lastTime = 0;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    const onWheel = (event: WheelEvent) => {
      if (disabled.matches || !event.cancelable || event.defaultPrevented ||
          event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
          !event.deltaY) return;
      const from = window.scrollY;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const to = Math.max(0, Math.min(max, (glide?.to ?? from) + event.deltaY * unit));
      if (from === to && !glide) return;
      event.preventDefault();
      glide = { from, to, start: performance.now() };
      lastScroll = from;
      schedule();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    disabled.addEventListener("change", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      disabled.removeEventListener("change", schedule);
      rows.forEach(({ row }) => row.removeAttribute("data-warping"));
    };
  }, [posts]);

  return (
    <div ref={list}>
      {posts.map((post, index) => {
        const id = `blog-viewport-warp-${index}`;
        return (
          <div key={post.id} className={styles.blogWarp} style={{ "--blog-warp-filter": `url(#${id})` } as CSSProperties}>
            <svg className="absolute size-0" aria-hidden="true" focusable="false">
              <filter id={id} x="-18%" y="-18%" width="136%" height="136%" colorInterpolationFilters="sRGB">
                <feImage preserveAspectRatio="none" result="viewportMap" />
                <feComponentTransfer in="viewportMap" result="pixelMap">
                  <feFuncR type="linear" />
                  <feFuncG type="linear" />
                </feComponentTransfer>
                <feDisplacementMap in="SourceGraphic" in2="pixelMap" scale="0" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </svg>
            <EditorialBlogRow post={post} />
          </div>
        );
      })}
    </div>
  );
}
