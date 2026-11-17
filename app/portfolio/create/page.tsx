"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotionEditor } from "@/components/custom/blog/notion-editor";
import { UploadedImagePicker } from "@/components/custom/uploaded-image-picker";
import { QuarterSelector } from "@/components/custom/quarter/quarter-selector";
import { ContributorPicker } from "@/components/custom/portfolio/contributor-picker";
import { createPortfolio } from "@/lib/api/portfolio";
import { uploadImage, deleteImage } from "@/lib/api/image";
import { ContributorInfo } from "@/lib/interfaces/portfolio";
import { useAuth } from "@/lib/contexts/AuthContext";
import { cn } from "@/lib/utils";
import editorialStyles from "@/components/custom/editorial.module.css";
import editorStyles from "@/components/custom/editor-deep.module.css";

export default function PortfolioCreatePage() {
  const router = useRouter();
  const { hasRole, isLoading: authLoading } = useAuth();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [startQuarterId, setStartQuarterId] = useState("");
  const [endQuarterId, setEndQuarterId] = useState("");
  const [isOngoing, setIsOngoing] = useState(false);
  const [contributors, setContributors] = useState<ContributorInfo[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<
    { id: string; url: string }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const sessionIdsRef = useRef<Set<string>>(new Set());
  const submittedRef = useRef(false);

  // 운영자(MANAGER) 이상만 작성 가능. 권한 확인이 끝난 뒤에만 판단한다.
  const canWrite = hasRole("MANAGER");

  useEffect(() => {
    if (authLoading || canWrite) return;
    router.replace("/portfolio");
  }, [authLoading, canWrite, router]);

  useEffect(() => {
    return () => {
      if (submittedRef.current) return;
      sessionIdsRef.current.forEach((id) => deleteImage(id).catch(() => {}));
    };
  }, []);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleImageUploaded = useCallback((id: string, url: string) => {
    sessionIdsRef.current.add(id);
    setUploadedImages((prev) => [...prev, { id, url }]);
    setThumbnailUrl((prev) => prev || url);
    setShowImagePicker(true);
  }, []);

  const handleBodyImageUrlsChange = useCallback((imageUrls: string[]) => {
    const imageUrlSet = new Set(imageUrls);

    setUploadedImages((prev) =>
      imageUrls.map(
        (url, index) =>
          prev.find((image) => image.url === url) ?? {
            id: `content-${index}-${url}`,
            url,
          },
      ),
    );
    if (imageUrls.length === 0) setShowImagePicker(false);
    setThumbnailUrl((prev) =>
      prev && !imageUrlSet.has(prev) ? (imageUrls[0] ?? "") : prev,
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const portfolio = await createPortfolio({
        title,
        description,
        thumbnailUrl,
        startQuarterId,
        endQuarterId: isOngoing ? "" : endQuarterId,
        contributors: contributors.map((c) => ({
          userId: c.userId,
          name: c.userId ? null : c.name,
          role: c.role,
        })),
      });
      router.push(`/portfolio/${portfolio.id}`);
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
    }
  };

  if (authLoading || !canWrite) return null;

  return (
    <main className={`${editorialStyles.page} ${editorStyles.editor}`}>
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground -ml-2"
          onClick={() => router.push("/portfolio")}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">목록으로</span>
        </Button>

        <div className="flex items-center gap-3">
          {uploadedImages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowImagePicker((v) => !v)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                showImagePicker
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">대표이미지</span>
            </button>
          )}

          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "저장 중..." : "게시"}
          </Button>
        </div>
      </div>

      {/* Title */}
      <textarea
        ref={titleRef}
        rows={1}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          autoResize(e.target);
        }}
        placeholder="프로젝트 이름"
        className="w-full resize-none overflow-hidden bg-transparent border-none outline-none text-4xl sm:text-6xl font-light tracking-tight placeholder:text-muted-foreground/30 leading-tight"
      />

      {/* Quarters + contributors */}
      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              시작 분기
            </label>
            <QuarterSelector
              value={startQuarterId}
              onChange={setStartQuarterId}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                종료 분기
              </label>
              <button
                type="button"
                onClick={() => setIsOngoing((v) => !v)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full transition-colors",
                  isOngoing
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isOngoing ? "진행 중" : "진행 중으로 표시"}
              </button>
            </div>
            {isOngoing ? (
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                진행 중
              </div>
            ) : (
              <QuarterSelector
                value={endQuarterId}
                onChange={setEndQuarterId}
                minQuarterId={startQuarterId}
              />
            )}
          </div>
        </div>

        <ContributorPicker
          contributors={contributors}
          onChange={setContributors}
        />
      </div>

      {/* Thumbnail picker (toggle) */}
      {showImagePicker && uploadedImages.length > 0 && (
        <div className="mt-4">
          <UploadedImagePicker
            images={uploadedImages}
            selectedUrl={thumbnailUrl}
            onSelect={setThumbnailUrl}
          />
        </div>
      )}

      {/* Divider */}
      <div className="my-6 border-t" />

      {/* Body editor */}
      <NotionEditor
        value={description}
        onChange={setDescription}
        onImageUpload={uploadImage}
        onImageUploaded={handleImageUploaded}
        onImageUrlsChange={handleBodyImageUrlsChange}
      />
    </form>
    </main>
  );
}
