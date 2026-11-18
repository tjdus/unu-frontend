"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { LectureTitleThumbnail } from "@/components/custom/about/lecture-title-thumbnail";
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

const lecturePreviews: AboutExample[] = process.env.NODE_ENV === "development" ? [
  { id: "preview-lecture-django", title: "Django", description: "Django로 URL, 뷰, 모델을 연결해 웹 앱을 만듭니다." },
  { id: "preview-lecture-web", title: "웹 입문", description: "HTML, CSS, JavaScript로 첫 웹 페이지를 만듭니다." },
  { id: "preview-lecture-spring", title: "Spring", description: "Spring Boot로 API를 만들고 요청에서 데이터 저장까지 이어 봅니다." },
  { id: "preview-lecture-security", title: "웹 보안", description: "웹의 주요 취약점을 실습하고 애플리케이션을 보호하는 방법을 배웁니다." },
].map((example) => ({ ...example, category: "LECTURE", thumbnailUrl: "", createdAt: "", modifiedAt: null })) : [];

const TITLE_THUMBNAIL_CATEGORIES = new Set(["LECTURE", "STUDY", "PROJECT", "MENTORING", "NETWORKING"]);

export default function AboutSectionDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { hasRole } = useAuth();
  const section = getAboutSection(params.slug);
  const isLecture = section?.category === "LECTURE";
  // Activity pages show each card's title as a 3D lettering thumbnail instead of a photo.
  const usesTitleThumbnail = !!section && TITLE_THUMBNAIL_CATEGORIES.has(section.category);
  const [examples, setExamples] = useState<AboutExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<AboutExample | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const displayedExamples = useMemo(
    () => isLecture && lecturePreviews.length ? [...examples, ...lecturePreviews] : examples,
    [examples, isLecture],
  );

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
          ) : displayedExamples.length === 0 ? (
            <p className={styles.empty}>아직 등록된 내용이 없습니다.</p>
          ) : (
            <div className={cn(styles.grid, savingOrder && styles.saving)}>
              {displayedExamples.map((example, index) => {
                const canManageExample = canManage && index < examples.length;
                return (
                  <article
                    key={example.id}
                    className={styles.card}
                    data-drop-target={
                      canManageExample && dragOverIndex === index && dragIndex.current !== null
                        ? ""
                        : undefined
                    }
                    data-dragging={canManageExample && dragIndex.current === index ? "" : undefined}
                    onDragEnter={canManageExample ? () => handleDragEnterItem(index) : undefined}
                    onDragOver={canManageExample ? (event) => event.preventDefault() : undefined}
                    onDrop={
                      canManageExample
                        ? (event) => {
                            event.preventDefault();
                            handleDropItem(index);
                          }
                        : undefined
                    }
                    onDragEnd={canManageExample ? handleDragEnd : undefined}
                  >
                    <div className={cn(styles.photo, usesTitleThumbnail && styles.lecturePhoto)}>
                      {usesTitleThumbnail ? (
                        <LectureTitleThumbnail title={example.title} />
                      ) : example.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={example.thumbnailUrl} alt={example.title} draggable={false} />
                      )}
                    </div>
                    <div className={styles.text}>
                      <div className={styles.cardHead}>
                        <h3>{example.title}</h3>
                        {canManageExample && (
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
                );
              })}
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
