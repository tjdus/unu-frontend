"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Pencil, Pin, Trash2 } from "lucide-react";
import { EditorialBackLink, EditorialDivider, EditorialMedia } from "@/components/custom/editorial";
import styles from "@/components/custom/editorial.module.css";
import { MarkdownPreview } from "@/components/custom/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  getPortfolioById,
  getCachedPortfolioById,
  getCachedPortfolios,
  getPortfolios,
  deletePortfolio,
  setPortfolioPinned,
} from "@/lib/api/portfolio";
import { getPreviewProjects } from "@/lib/api/editorial-preview";
import { useAuth } from "@/lib/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatDotDate } from "@/lib/utils/date-utils";

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PortfolioDetail key={id} id={id} />;
}

function PortfolioDetail({ id }: { id: string }) {
  const router = useRouter();
  const { userId, hasRole } = useAuth();
  const preview = getPreviewProjects().find((item) => item.id === id);
  const [portfolio, setPortfolio] = useState(() => preview ?? getCachedPortfolioById(id) ?? null);
  const [loading, setLoading] = useState(() => !preview && !getCachedPortfolioById(id));
  const [projects, setProjects] = useState(() =>
    preview ? getPreviewProjects() : getCachedPortfolios()?.portfolios ?? [],
  );

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    getPortfolioById(id)
      .then((value) => { if (!cancelled) setPortfolio(value); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    getPortfolios()
      .then(({ portfolios }) => { if (!cancelled) setProjects(portfolios); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [id, preview]);

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deletePortfolio(id);
    router.push("/portfolio");
  };

  const handleTogglePin = async () => {
    if (!portfolio) return;
    const updated = await setPortfolioPinned(id, !portfolio.pinned);
    setPortfolio(updated);
    setProjects((items) => items.map((item) => item.id === id ? updated : item));
  };

  const isAuthor = !!userId && portfolio?.createdBy === userId;
  const canManage = !preview && (hasRole("ADMIN") || (hasRole("MANAGER") && isAuthor));

  if (loading || !portfolio) {
    return (
      <main className={styles.page}>
        <div className={cn(styles.shell, styles.projectHead)}>
          <EditorialBackLink href="/portfolio">Work</EditorialBackLink>
          {loading ? (
            <div className={cn(styles.media, styles.cover, styles.skeleton, "animate-pulse")} role="status" aria-label="불러오는 중" />
          ) : <p className={styles.status}>포트폴리오를 찾을 수 없습니다.</p>}
        </div>
      </main>
    );
  }

  const sorted = [...projects].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const currentIndex = sorted.findIndex((item) => item.id === id);
  const next = sorted[currentIndex + 1] ?? sorted[0];
  const nextProject = next?.id !== id ? next : undefined;
  const roles = [...new Set(portfolio.contributors.map(({ role }) => role?.trim()).filter(Boolean))];
  const facts = [
    ["Period", `${portfolio.startQuarterName} – ${portfolio.endQuarterName ?? "진행 중"}`],
    ["Team", `${portfolio.contributors.length}명`],
    ["Role", roles.join(" · ") || "—"],
    ["Published", formatDotDate(portfolio.createdAt)],
  ];

  return (
    <main className={styles.page}>
      <header className={cn(styles.shell, styles.projectHead)}>
        <div className={styles.backRow}>
          <EditorialBackLink href="/portfolio">Work</EditorialBackLink>
          <div className="flex flex-wrap items-center gap-1">
            {!preview && hasRole("MANAGER") && (
              <Button variant="ghost" size="sm" className={styles.toolButton} onClick={handleTogglePin}
                aria-label={portfolio.pinned ? "고정 해제" : "포트폴리오 고정"}>
                <Pin className={cn("size-4", portfolio.pinned && "fill-current")} />
                {portfolio.pinned ? "고정됨" : "고정"}
              </Button>
            )}
            {canManage && (
              <>
                <Button asChild variant="ghost" size="sm" className={styles.toolButton}>
                  <Link href={`/portfolio/${id}/edit`}><Pencil className="size-4" /> 수정</Link>
                </Button>
                <Button variant="ghost" size="sm" className={styles.toolButton} onClick={handleDelete}>
                  <Trash2 className="size-4" /> 삭제
                </Button>
              </>
            )}
          </div>
        </div>
        <h1 className={styles.projectTitle}>{portfolio.title}</h1>
        <dl className={styles.projectMeta}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className={styles.eyebrow}>{label.toUpperCase()}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>
      <div className={styles.shell}>
        <EditorialMedia src={portfolio.thumbnailUrl} alt={portfolio.title} className={styles.cover} />
        <section className={styles.projectSection} aria-labelledby="overview">
          <h2 id="overview">OVERVIEW</h2>
          <article className={styles.markdown}>
            <MarkdownPreview content={portfolio.description} hiddenImageUrl={portfolio.thumbnailUrl || undefined} />
          </article>
        </section>
        <section className={cn(styles.projectSection, styles.teamSection)} aria-labelledby="project-team">
          <h2 id="project-team">TEAM</h2>
          <ul className={styles.teamList}>
            {portfolio.contributors.length ? portfolio.contributors.map(({ id, name, role }) => (
              <li key={id}><span>{name}</span><span>{role || "—"}</span></li>
            )) : <li><span>등록된 참여자가 없습니다.</span></li>}
          </ul>
        </section>
      </div>
      <EditorialDivider />
      {nextProject ? (
        <Link href={`/portfolio/${nextProject.id}`} className={cn(styles.shell, styles.nextProject)}>
          <div className="min-w-0">
            <span className={styles.eyebrow}>NEXT PROJECT</span>
            <strong>{nextProject.title}</strong>
          </div>
          <ArrowRight size={44} className="shrink-0" aria-hidden="true" />
        </Link>
      ) : (
        <div className={cn(styles.shell, styles.nextProject)}>
          <EditorialBackLink href="/portfolio">활동 목록으로</EditorialBackLink>
        </div>
      )}
    </main>
  );
}
