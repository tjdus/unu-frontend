"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EditorialHero, EditorialMedia } from "@/components/custom/editorial";
import { WorkGallery } from "@/components/custom/portfolio/work-gallery";
import styles from "@/components/custom/editorial.module.css";
import { Button } from "@/components/ui/button";
import { getCachedPortfolios } from "@/lib/api/portfolio";
import { orderWorkList, readWorkList } from "@/lib/api/editorial-preview";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { PortfolioResponse } from "@/lib/interfaces/portfolio";
import { cn } from "@/lib/utils";

function WorkCard({ item }: { item: PortfolioResponse }) {
  const summary = item.description.split(/\r?\n/).map((line) => line.trim())
    .find((line) => line && !line.startsWith("![") && !line.startsWith("```"));

  return (
    <div className={styles.workCardSlot}>
      <Link href={`/portfolio/${item.id}`} className={styles.workCard}>
        <div className={styles.workMeta}>
          <h2 className={styles.workTitle}>
            <span>{item.title}</span>
            <span aria-hidden="true">{item.title}</span>
          </h2>
          <span className={styles.metaNumber}>
            {item.startQuarterName} – {item.endQuarterName ?? "진행 중"}
          </span>
        </div>
        <EditorialMedia src={item.thumbnailUrl}>
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
            {sorted.map((item) => <WorkCard key={item.id} item={item} />)}
          </WorkGallery>
        ) : (
          <p className={styles.status}>{failed ? "프로젝트를 불러오지 못했습니다." : "등록된 프로젝트가 없습니다."}</p>
        )}
      </section>
    </main>
  );
}
