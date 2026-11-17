"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { EditorialBackLink, EditorialBlogRow, EditorialDivider, EditorialMedia } from "@/components/custom/editorial";
import styles from "@/components/custom/editorial.module.css";
import { MarkdownPreview } from "@/components/custom/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  getBlogPostById,
  getCachedBlogPostById,
  getCachedBlogPosts,
  getBlogPosts,
  deleteBlogPost,
} from "@/lib/api/blog";
import { getPreviewPosts } from "@/lib/api/editorial-preview";
import { useAuth } from "@/lib/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatDotDate } from "@/lib/utils/date-utils";

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <BlogDetail key={id} id={id} />;
}

function BlogDetail({ id }: { id: string }) {
  const router = useRouter();
  const { userId, hasRole, hasAnyRole } = useAuth();
  const preview = getPreviewPosts().find((item) => item.id === id);
  const [post, setPost] = useState(() => preview ?? getCachedBlogPostById(id) ?? null);
  const [loading, setLoading] = useState(() => !preview && !getCachedBlogPostById(id));
  const [otherPosts, setOtherPosts] = useState(() =>
    (preview ? getPreviewPosts() : getCachedBlogPosts()?.posts ?? [])
      .filter((item) => item.id !== id).slice(0, 2),
  );

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    getBlogPostById(id)
      .then((value) => { if (!cancelled) setPost(value); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    getBlogPosts()
      .then(({ posts }) => {
        if (!cancelled) setOtherPosts(posts.filter((item) => item.id !== id).slice(0, 2));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [id, preview]);

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteBlogPost(id);
    router.push("/blog");
  };

  const isAuthor = !!userId && post?.createdBy?.id === userId;
  const canManage = !preview && (hasRole("ADMIN") || (hasAnyRole(["MANAGER", "BLOG_MANAGER"]) && isAuthor));

  if (loading || !post) {
    return (
      <main className={styles.page}>
        <div className={styles.postColumn}>
          <EditorialBackLink href="/blog">Blog</EditorialBackLink>
          {loading ? (
            <div className={cn(styles.media, styles.postCover, styles.skeleton, "mt-8 animate-pulse")} role="status" aria-label="불러오는 중" />
          ) : <p className={styles.status}>게시글을 찾을 수 없습니다.</p>}
        </div>
      </main>
    );
  }

  const githubId = post.createdBy?.githubId?.trim();
  return (
    <main className={styles.page}>
      <div className={styles.postColumn}>
        <header className={styles.postHead}>
          <div className={styles.backRow}>
            <EditorialBackLink href="/blog">Blog</EditorialBackLink>
            {canManage && (
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm" className={styles.toolButton}>
                  <Link href={`/blog/${id}/edit`}><Pencil className="size-4" /> 수정</Link>
                </Button>
                <Button variant="ghost" size="sm" className={styles.toolButton} onClick={handleDelete}>
                  <Trash2 className="size-4" /> 삭제
                </Button>
              </div>
            )}
          </div>
          <span className={styles.chip}>{post.category === "tech" ? "Tech" : "Essay"}</span>
          <h1>{post.title}</h1>
          {post.subtitle && <p className={styles.postSubtitle}>{post.subtitle}</p>}
          <div className={styles.postByline}>
            <span>{post.createdBy?.name || "알 수 없음"}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.createdAt} className={styles.metaNumber}>{formatDotDate(post.createdAt)}</time>
            {githubId && (
              <a href={`https://github.com/${encodeURIComponent(githubId)}`} target="_blank" rel="noreferrer"
                className={styles.githubLink} aria-label={`${post.createdBy?.name || githubId}의 GitHub 프로필 열기`}
                title={`@${githubId}`}>
                <Image src="/github-icon.svg" alt="" width={20} height={20} />
              </a>
            )}
          </div>
        </header>
        <EditorialMedia src={post.thumbnailUrl} alt={post.title} fallbackTitle={post.title} className={styles.postCover} />
        <article className={cn(styles.markdown, styles.postBody)}>
          <MarkdownPreview content={post.description} hiddenImageUrl={post.thumbnailUrl || undefined} />
        </article>
      </div>
      {otherPosts.length > 0 && (
        <>
          <EditorialDivider />
          <section className={cn(styles.shell, styles.morePosts)} aria-labelledby="more-posts">
            <div className={styles.moreHeading}>
              <h2 id="more-posts">More posts</h2>
              <Link href="/blog" className={styles.textLink}>
                전체 글 보기 <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {otherPosts.map((item) => <EditorialBlogRow key={item.id} post={item} compact />)}
          </section>
        </>
      )}
    </main>
  );
}
