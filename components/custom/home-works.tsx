"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { DefaultBlogThumbnail } from "@/components/custom/blog/default-blog-thumbnail";
import styles from "./home-works.module.css";

// Both cards show a 3D object instead of a photo; three.js loads only on the client.
const HomeWorkObject = dynamic(
  () => import("./home-work-object").then((module) => module.HomeWorkObject),
  { ssr: false },
);
const HomeBlogObject = dynamic(
  () => import("./home-blog-object").then((module) => module.HomeBlogObject),
  { ssr: false },
);

const OBJECTS = { work: HomeWorkObject, blog: HomeBlogObject };

type HomeWorkItem = {
  title: string;
  href: string;
  description: string;
  image?: string;
  fallbackTitle?: string;
  object?: keyof typeof OBJECTS;
};

const ITEMS: HomeWorkItem[] = [
  { title: "Work", href: "/portfolio", description: "CNU가 만들어온 활동을 소개합니다.", object: "work" },
  { title: "Blog", href: "/blog", description: "기술과 경험, 그리고 생각을 나눕니다.", object: "blog" },
];

// Inner-photo parallax travel (fraction of the frame height, each way).
const PARALLAX = 0.08;

/**
 * Cerebrium-style feature list: a sticky title list on the left (the title of the card in
 * view is highlighted, clicking one scrolls to its card) and stacked photo cards on the
 * right, whose photos drift slightly inside their frames while scrolling.
 */
export function HomeWorks({ className }: { className?: string }) {
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const items = ITEMS;

  // Highlight the title of the card crossing the middle of the viewport.
  useEffect(() => {
    const cards = cardRefs.current.filter((card): card is HTMLElement => card !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items.length]);

  // Inner parallax: layout cached on resize, scrolling only writes transforms.
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const layers = cardRefs.current
      .map((card) => card?.querySelector<HTMLElement>("[data-parallax]"))
      .filter((layer): layer is HTMLElement => Boolean(layer));
    if (layers.length === 0) return;

    let centers: number[] = [];
    let heights: number[] = [];
    let frame = 0;

    const measure = () => {
      centers = layers.map((layer) => {
        const frameEl = layer.parentElement!;
        const rect = frameEl.getBoundingClientRect();
        return rect.top + window.scrollY + rect.height / 2;
      });
      heights = layers.map((layer) => layer.parentElement!.getBoundingClientRect().height);
    };

    const update = () => {
      frame = 0;
      const viewportCenter = window.scrollY + window.innerHeight / 2;
      layers.forEach((layer, index) => {
        const progress = Math.max(-1, Math.min(1, (centers[index] - viewportCenter) / window.innerHeight));
        layer.style.transform = `translate3d(0, ${(progress * PARALLAX * heights[index]).toFixed(1)}px, 0)`;
      });
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const relayout = () => {
      measure();
      schedule();
    };

    relayout();
    const resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", relayout, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", relayout);
    };
  }, [items]);

  const scrollToCard = (index: number) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRefs.current[index]?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  };

  return (
    <section aria-label="Works" className={className}>
      <div className={styles.grid}>
        <div className={styles.aside}>
          <div className={styles.sticky}>
            <ul className={styles.nav}>
              {items.map((item, index) => (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => scrollToCard(index)}
                    aria-current={index === active ? "true" : undefined}
                    className={`${styles.navItem} ${index === active ? styles.navActive : ""}`}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.cards}>
          {items.map((item, index) => (
            <article
              key={item.href}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              data-index={index}
              className={styles.card}
            >
              <Link href={item.href} className={styles.photo} aria-label={`${item.title} 바로가기`}>
                <span className={`${styles.frame} ${item.object ? styles.bare : ""}`}>
                  {item.object ? (
                    (() => {
                      const ItemObject = OBJECTS[item.object];
                      return <ItemObject />;
                    })()
                  ) : item.image ? (
                    <span data-parallax className={styles.parallax}>
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="(min-width: 900px) min(820px, 62.5vw - 80px), (min-width: 640px) calc(100vw - 80px), calc(100vw - 40px)"
                        className={styles.image}
                        unoptimized={!item.image.startsWith("/") || item.image.startsWith("//")}
                      />
                    </span>
                  ) : item.fallbackTitle ? (
                    <DefaultBlogThumbnail title={item.fallbackTitle} className={styles.blogThumbnail} />
                  ) : (
                    <span className={styles.placeholder} aria-hidden="true">
                      Photo
                    </span>
                  )}
                </span>
              </Link>
              <div className={styles.meta}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.description}>{item.description}</p>
                <Link href={item.href} className={styles.more}>
                  바로가기
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
