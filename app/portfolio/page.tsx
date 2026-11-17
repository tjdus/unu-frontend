"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EditorialHero, EditorialMedia } from "@/components/custom/editorial";
import { WorkGallery, WorkTitle } from "@/components/custom/portfolio/work-gallery";
import dynamic from "next/dynamic";
import starStyles from "@/components/custom/portfolio/work-star-thumbnail.module.css";
import styles from "@/components/custom/editorial.module.css";
import { Button } from "@/components/ui/button";
import { getCachedPortfolios } from "@/lib/api/portfolio";
import { orderWorkList, readWorkList } from "@/lib/api/editorial-preview";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { PortfolioResponse } from "@/lib/interfaces/portfolio";
import { cn } from "@/lib/utils";

// 3D star thumbnail (three.js) loads in the browser only.
const WorkStarThumbnail = dynamic(
  () => import("@/components/custom/portfolio/work-star-thumbnail").then((module) => module.WorkStarThumbnail),
  { ssr: false },
);

function WorkCard({ item, index }: { item: PortfolioResponse; index: number }) {
  const summary = item.description.split(/\r?\n/).map((line) => line.trim())
    .find((line) => line && !line.startsWith("![") && !line.startsWith("```"));

  return (
    <div className={styles.workCardSlot}>
      <Link href={`/portfolio/${item.id}`} className={styles.workCard}>
        <div className={styles.workMeta}>
          <WorkTitle title={item.title} />
          <span className={styles.metaNumber}>
            {item.startQuarterName} – {item.endQuarterName ?? "진행 중"}
          </span>
        </div>
        {/* Every project uses the 3D star thumbnail, coloured from the palette by position. */}
        <EditorialMedia className={starStyles.frame}>
          <WorkStarThumbnail index={index} />
          {item.pinned && <span className={styles.pin}>Pinned</span>}
        </EditorialMedia>
        {summary && <p className="line-clamp-2">{summary.replace(/^#{1,6}\s+/, "")}</p>}
        <span className={styles.metaNumber}>참여 {item.contributors.length}명</span>
      </Link>
    </div>
  );
}

export default function PortfolioPage() {
  const { hasRole } = useAuth();
  const [portfolios, setPortfolios] = useState(() => getCachedPortfolios()?.portfolios ?? []);
  const [loading, setLoading] = useState(() => !getCachedPortfolios());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readWorkList()
      .then((portfolios) => { if (!cancelled) setPortfolios(portfolios); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sorted = orderWorkList(portfolios);

  return (
    <main className={styles.page}>
      <EditorialHero title="Work" action={
        hasRole("MANAGER") && (
          <Button asChild size="sm" className={styles.action}>
            <Link href="/portfolio/create">추가</Link>
          </Button>
        )
      }>
        CNU 학회원들이 직접 기획하고<br />개발·배포한 프로젝트를 소개합니다.
      </EditorialHero>
      <section className={cn(styles.shell, styles.archive)} aria-label="프로젝트 목록" aria-busy={loading}>
        {loading ? (
          <div className={styles.workGrid} aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={cn(styles.media, styles.skeleton, "aspect-[4/3]! animate-pulse")} />
            ))}
          </div>
        ) : sorted.length ? (
          <WorkGallery>
            {sorted.map((item, index) => <WorkCard key={item.id} item={item} index={index} />)}
          </WorkGallery>
        ) : (
          <p className={styles.status}>{failed ? "프로젝트를 불러오지 못했습니다." : "등록된 프로젝트가 없습니다."}</p>
        )}
      </section>
    </main>
  );
}
