"use client";

import { PageLoadingScreen } from "@/components/custom/page-loading-screen";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorialHero, EditorialPagination } from "@/components/custom/editorial";
import { BlogScrollWarp } from "@/components/custom/blog/blog-scroll-warp";
import styles from "@/components/custom/editorial.module.css";
import { Button } from "@/components/ui/button";
import { getCachedBlogPosts } from "@/lib/api/blog";
import { readBlogList } from "@/lib/api/editorial-preview";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { BlogCategory } from "@/lib/interfaces/blog";
import { cn } from "@/lib/utils";

type Filter = "all" | BlogCategory;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "tech", label: "Tech" },
  { value: "essay", label: "Essay" },
];
const PAGE_SIZE = 3;

export default function BlogPage() {
  const { hasAnyRole } = useAuth();
  const list = useRef<HTMLElement>(null);
  const [posts, setPosts] = useState(() => getCachedBlogPosts()?.posts ?? []);
  const [loading, setLoading] = useState(() => !getCachedBlogPosts());
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    readBlogList(active === "all" ? undefined : active)
      .then((posts) => { if (!cancelled) setPosts(posts); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  const handleFilterChange = (value: Filter) => {
    if (value === active) return;
    const cached = getCachedBlogPosts(value === "all" ? undefined : value);
    setPosts(cached?.posts ?? []);
    setLoading(!cached);
    setFailed(false);
    setPage(1);
    setActive(value);
  };

  const pageCount = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = posts.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <main className={styles.page}>
      <PageLoadingScreen busy={loading} />
      <EditorialHero title="Blog" action={
        hasAnyRole(["ADMIN", "MANAGER", "BLOG_MANAGER"]) && (
          <Button asChild size="sm" className={styles.action}>
            <Link href="/blog/create">글 작성</Link>
          </Button>
        )
      }>
        기술과 경험,<br />그리고 생각을 나눕니다.
      </EditorialHero>
      <section ref={list} className={cn(styles.shell, styles.archive, styles.blogArchive)} aria-label="블로그 글 목록">
        <div className={styles.filters} role="group" aria-label="글 분류">
          {FILTERS.map(({ value, label }) => (
            <button key={value} type="button" className={styles.chip} aria-pressed={active === value}
              onClick={() => handleFilterChange(value)}>
              {label}
            </button>
          ))}
        </div>
        <div aria-busy={loading}>
          {loading ? (
            Array.from({ length: PAGE_SIZE }, (_, i) => (
              <div key={i} className={styles.blogRow} aria-hidden="true">
                <div className={cn(styles.media, styles.skeleton, "animate-pulse")} />
                <div className={cn(styles.skeleton, "h-12 w-4/5 animate-pulse rounded")} />
              </div>
            ))
          ) : visible.length ? (
            <BlogScrollWarp posts={visible} />
          ) : (
            <p className={styles.status}>{failed ? "게시글을 불러오지 못했습니다." : "게시글이 없습니다."}</p>
          )}
        </div>
        <EditorialPagination page={current} count={pageCount} onChange={(next) => {
          setPage(next);
          list.current?.scrollIntoView({ block: "start", behavior: "instant" });
        }} />
      </section>
    </main>
  );
}
