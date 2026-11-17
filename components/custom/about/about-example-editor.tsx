"use client";

import axios from "axios";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AboutSectionInfo } from "@/lib/about-sections";
import {
  createAboutExample,
  updateAboutExample,
} from "@/lib/api/about-example";
import { deleteImage, uploadImage } from "@/lib/api/image";
import { AboutExample } from "@/lib/interfaces/about-example";
import { useAuth } from "@/lib/contexts/AuthContext";
import aboutStyles from "@/app/about/about.module.css";
import styles from "./about-example-editor.module.css";

interface AboutExampleEditorProps {
  section: AboutSectionInfo;
  example?: AboutExample;
}

function errorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function AboutExampleEditor({
  section,
  example,
}: AboutExampleEditorProps) {
  const router = useRouter();
  const { hasRole, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const [title, setTitle] = useState(example?.title ?? "");
  const [description, setDescription] = useState(example?.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    example?.thumbnailUrl ?? "",
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const canManage = hasRole("MANAGER");
  const detailPath = `/about/${section.slug}`;

  useEffect(() => {
    if (authLoading || canManage) return;
    router.replace(detailPath);
  }, [authLoading, canManage, detailPath, router]);

  useEffect(() => {
    return () => {
      const pendingId = pendingImageIdRef.current;
      if (!savedRef.current && pendingId) {
        void deleteImage(pendingId).catch(() => {});
      }
    };
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    if (uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일을 선택해 주세요.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지는 10MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadImage(file);
      const previousPendingId = pendingImageIdRef.current;
      pendingImageIdRef.current = uploaded.id;
      setThumbnailUrl(uploaded.url);
      if (previousPendingId) {
        void deleteImage(previousPendingId).catch(() => {});
      }
    } catch (error) {
      toast.error(errorMessage(error, "이미지를 업로드하지 못했습니다."));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("제목을 입력해 주세요.");
      return;
    }
    if (!description.trim()) {
      toast.error("설명을 입력해 주세요.");
      return;
    }
    if (!thumbnailUrl) {
      toast.error("대표 이미지를 등록해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        category: section.category,
        title: title.trim(),
        description: description.trim(),
        thumbnailUrl,
      };
      if (example) {
        await updateAboutExample(example.id, data);
        toast.success("소개 글을 수정했습니다.");
      } else {
        await createAboutExample(data);
        toast.success("소개 글을 등록했습니다.");
      }
      savedRef.current = true;
      pendingImageIdRef.current = null;
      router.push(detailPath);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "소개 글을 저장하지 못했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void uploadFile(file);
    },
    "data-over": dragOver ? "" : undefined,
  };

  if (authLoading || !canManage) return null;

  return (
    <main className={aboutStyles.page}>
      <div className={styles.editor}>
        <Link href={detailPath} className={styles.back}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {section.title}
        </Link>

        <h1 className={styles.title}>{example ? "소개 글 수정" : "소개 글 작성"}</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="about-example-title" className={styles.label}>
              제목
            </label>
            <input
              id="about-example-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="활동이나 지원 사례의 제목을 입력해 주세요."
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="about-example-description" className={styles.label}>
              설명
            </label>
            <textarea
              id="about-example-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="사례에 대한 설명을 입력해 주세요."
              className={styles.textarea}
            />
          </div>

          <div className={styles.field}>
            <span id="about-example-image" className={styles.label}>
              대표 이미지
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-labelledby="about-example-image"
              onChange={handleImageChange}
            />
            {thumbnailUrl ? (
              <button type="button" onClick={pickFile} className={styles.preview} {...dropProps}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnailUrl} alt="대표 이미지 미리보기" />
                <span className={styles.previewLabel}>
                  {uploading ? "업로드 중..." : "이미지 변경"}
                </span>
              </button>
            ) : (
              <button type="button" onClick={pickFile} className={styles.upload} {...dropProps}>
                <span className={styles.uploadText}>
                  {uploading ? "업로드 중..." : "이미지를 끌어다 놓거나 클릭해 선택"}
                </span>
                <span className={styles.uploadHint}>10MB 이하 이미지</span>
              </button>
            )}
          </div>

          <div className={styles.actions}>
            <Link href={detailPath} className={`${styles.button} ${styles.cancel}`}>
              취소
            </Link>
            <button
              type="submit"
              disabled={uploading || submitting}
              className={`${styles.button} ${styles.save}`}
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
