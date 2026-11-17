import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DefaultBlogThumbnail } from "@/components/custom/blog/default-blog-thumbnail";
import { HomeScrollDivider } from "@/components/custom/home-scroll-divider";
import type { BlogPost } from "@/lib/interfaces/blog";
import { formatDotDate } from "@/lib/utils/date-utils";
import { cn } from "@/lib/utils";
import styles from "./editorial.module.css";

export function EditorialHero({ title, children, action }: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <>
      <section className={cn(styles.shell, styles.hero)}>
        <h1>{title}</h1>
        <div className={styles.heroAside}>
          <p>{children}</p>
          {action}
        </div>
      </section>
      <EditorialDivider />
    </>
  );
}

export function EditorialDivider() {
  return (
    <div className={styles.divider}>
      <HomeScrollDivider />
    </div>
  );
}

export function EditorialBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.textLink}>
      <ArrowLeft size={14} aria-hidden="true" />
      {children}
    </Link>
  );
}

export function EditorialPagination({ page, count, onChange }: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  if (count < 2) return null;
  const first = Math.max(1, Math.min(page - 2, count - 4));
  return (
    <nav className={styles.pagination} aria-label="목록 페이지">
      {page > 1 && (
        <button type="button" onClick={() => onChange(page - 1)} aria-label="이전 페이지">
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
      )}
      {Array.from({ length: Math.min(5, count) }, (_, i) => first + i).map((number) => (
        <button
          key={number}
          type="button"
          aria-label={`${number} 페이지`}
          aria-current={page === number ? "page" : undefined}
          onClick={() => { if (number !== page) onChange(number); }}
        >
          {number}
        </button>
      ))}
      {page < count && (
        <button type="button" onClick={() => onChange(page + 1)} aria-label="다음 페이지">
          Next <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
    </nav>
  );
}

export function EditorialMedia({ src, alt, fallbackTitle, className, children }: {
  src?: string;
  alt?: string;
  fallbackTitle?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn(styles.media, className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className={styles.mediaImage} loading="lazy" />
      ) : fallbackTitle ? (
        <DefaultBlogThumbnail
          title={fallbackTitle}
          className={styles.defaultThumbnail}
          titleClassName={styles.defaultThumbnailTitle}
        />
      ) : null}
      {children}
    </div>
  );
}

export function EditorialBlogRow({ post, compact = false }: { post: BlogPost; compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return (
    <Link href={`/blog/${post.id}`} className={cn(styles.blogRow, compact && styles.blogRowCompact)}>
      <EditorialMedia src={post.thumbnailUrl} fallbackTitle={post.title} />
      <div className={styles.blogText}>
        <span className={styles.chip}>{post.category === "tech" ? "Tech" : "Essay"}</span>
        <Heading>{post.title}</Heading>
        {post.subtitle && <p>{post.subtitle}</p>}
      </div>
      <div className={styles.byline}>
        <span>{post.createdBy?.name || "알 수 없음"}</span>
        <time dateTime={post.createdAt}>{formatDotDate(post.createdAt)}</time>
      </div>
    </Link>
  );
}
