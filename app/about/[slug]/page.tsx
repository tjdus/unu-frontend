"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteAboutExample,
  getAboutExamples,
  reorderAboutExamples,
} from "@/lib/api/about-example";
import { ABOUT_INFO_GROUPS, getAboutSection } from "@/lib/about-sections";
import { AboutExample } from "@/lib/interfaces/about-example";
import { useAuth } from "@/lib/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { HomeScrollDivider } from "@/components/custom/home-scroll-divider";
import aboutStyles from "../about.module.css";
import styles from "./detail.module.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Minimal card entrance: once a card scrolls into view its photo opens upward and its
 * text settles in (styles: [data-reveal] / [data-in] in detail.module.css). Without JS,
 * or with reduced motion, cards simply show.
 */
function useRevealOnView(ref: RefObject<HTMLElement | null>, items: unknown[]) {
  useEffect(() => {
    const grid = ref.current;
    if (!grid || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = Array.from(grid.children) as HTMLElement[];
    const pending = cards.filter((card) => !card.hasAttribute("data-in"));
    if (!pending.length) return;
    grid.dataset.reveal = "";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.in = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.2 },
    );
    pending.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [ref, items]);
}

export default function AboutSectionDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { hasRole } = useAuth();
  const section = getAboutSection(params.slug);
  const [examples, setExamples] = useState<AboutExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<AboutExample | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  useRevealOnView(gridRef, examples);

  const loadExamples = useCallback(async () => {
    if (!section) return;
    setLoading(true);
    try {
      setExamples(await getAboutExamples(section.category));
    } catch {
      toast.error("소개 글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    if (!section) {
      router.replace("/about");
      return;
    }
    void loadExamples();
  }, [loadExamples, router, section]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await deleteAboutExample(deleting.id);
      setExamples((current) =>
        current.filter((example) => example.id !== deleting.id),
      );
      setDeleting(null);
      toast.success("소개 글을 삭제했습니다.");
    } catch {
      toast.error("소개 글을 삭제하지 못했습니다.");
    } finally {
      setDeletePending(false);
    }
  };

  const persistOrder = async (next: AboutExample[]) => {
    const previous = examples;
    setExamples(next);
    setSavingOrder(true);
    try {
      await reorderAboutExamples(next.map((example) => example.id));
    } catch {
      setExamples(previous);
      toast.error("순서를 저장하지 못했습니다.");
    } finally {
      setSavingOrder(false);
    }
  };

  const moveExample = (from: number, to: number) => {
    if (from === to) return;
    const next = [...examples];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  };

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
    setDragOverIndex(index);
  };

  const handleDragEnterItem = (index: number) => {
    if (dragIndex.current === null) return;
    setDragOverIndex(index);
  };

  const handleDropItem = (index: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (from === null) return;
    moveExample(from, index);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  if (!section) return null;

  const canManage = hasRole("MANAGER");

  return (
    <main className={aboutStyles.page}>
      <section className={styles.hero} aria-labelledby="about-section-title">
        <nav className={styles.crumbs} aria-label="위치">
          <Link href="/about">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            About Us
          </Link>
          <span aria-hidden="true">/</span>
          <span>{section.groupTitle}</span>
        </nav>
        <p className={styles.bigTitle} aria-hidden="true" lang="en">
          {section.watermark}
        </p>
        <div className={styles.intro}>
          <h1 id="about-section-title">{section.title}</h1>
          <p>{section.description}</p>
        </div>
      </section>

      <div className={styles.divider}>
        <HomeScrollDivider />
      </div>

      <div className={styles.cases}>
        <nav className={styles.nav} aria-label="활동 및 지원">
          {ABOUT_INFO_GROUPS.map((group) => (
            <div key={group.id} className={styles.navGroup}>
              <span className={styles.navLabel}>{group.title}</span>
              {group.items.map((item) => (
                <Link
                  key={item.slug}
                  href={`/about/${item.slug}`}
                  aria-current={item.slug === section.slug ? "page" : undefined}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <section className={styles.list} aria-labelledby="about-cases-title">
          <div className={styles.head}>
            <h2 id="about-cases-title">{section.caseTitle}</h2>
            {canManage && (
              <div className={styles.tools}>
                {!loading && canManage && examples.length > 1 && (
                  <span className={styles.hint}>드래그하여 순서 변경</span>
                )}
                <Link href={`/about/${section.slug}/create`} className={styles.write}>
                  <Plus className="size-4" aria-hidden="true" />
                  작성
                </Link>
              </div>
            )}
          </div>

          {loading ? (
            <div className={styles.grid}>
              {[0, 1].map((item) => (
                <div key={item} className={styles.skeleton} />
              ))}
            </div>
          ) : examples.length === 0 ? (
            <p className={styles.empty}>아직 등록된 내용이 없습니다.</p>
          ) : (
            <div ref={gridRef} className={cn(styles.grid, savingOrder && styles.saving)}>
              {examples.map((example, index) => (
                <article
                  key={example.id}
                  className={styles.card}
                  style={{ "--col": index % 2 } as CSSProperties}
                  data-drop-target={
                    canManage && dragOverIndex === index && dragIndex.current !== null
                      ? ""
                      : undefined
                  }
                  data-dragging={canManage && dragIndex.current === index ? "" : undefined}
                  onDragEnter={canManage ? () => handleDragEnterItem(index) : undefined}
                  onDragOver={canManage ? (event) => event.preventDefault() : undefined}
                  onDrop={
                    canManage
                      ? (event) => {
                          event.preventDefault();
                          handleDropItem(index);
                        }
                      : undefined
                  }
                  onDragEnd={canManage ? handleDragEnd : undefined}
                >
                  <div className={styles.photo}>
                    {example.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={example.thumbnailUrl} alt={example.title} draggable={false} />
                    )}
                  </div>
                  <div className={styles.text}>
                  <div className={styles.cardHead}>
                    <h3>{example.title}</h3>
                    {canManage && (
                      <div className={styles.cardTools}>
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label={`${example.title} 순서 변경 손잡이`}
                          title="드래그하여 순서 변경"
                          draggable={!savingOrder}
                          onDragStart={() => handleDragStart(index)}
                          onDragEnd={handleDragEnd}
                          className={cn(styles.iconButton, styles.handle)}
                        >
                          <GripVertical className="size-4" />
                        </span>
                        <Link
                          href={`/about/${section.slug}/${example.id}/edit`}
                          title="수정"
                          aria-label={`${example.title} 수정`}
                          className={styles.iconButton}
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <button
                          type="button"
                          title="삭제"
                          aria-label={`${example.title} 삭제`}
                          className={styles.iconButton}
                          onClick={() => setDeleting(example)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                    <p>{example.description}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !deletePending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>소개 글을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.title ?? "선택한 글"}과 등록된 이미지가 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deletePending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
