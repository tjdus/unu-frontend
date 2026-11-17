"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { UploadedImagePicker } from "@/components/custom/uploaded-image-picker";

const NotionEditor = dynamic(
  () =>
    import("@/components/custom/blog/notion-editor").then((m) => ({
      default: m.NotionEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-72 bg-muted/40 animate-pulse rounded-lg" />
    ),
  },
);
import { getBlogPostById, updateBlogPost } from "@/lib/api/blog";
import { uploadImage, deleteImage } from "@/lib/api/image";
import { BlogRequest, BlogCategory } from "@/lib/interfaces/blog";
import { useAuth } from "@/lib/contexts/AuthContext";
import { cn } from "@/lib/utils";
import editorialStyles from "@/components/custom/editorial.module.css";
import editorStyles from "@/components/custom/editor-deep.module.css";

const CATEGORIES: { value: BlogCategory; label: string }[] = [
  { value: "tech", label: "Tech" },
  { value: "essay", label: "Essay" },
];

export default function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasAnyRole, isLoading: authLoading } = useAuth();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const subtitleRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<BlogRequest | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<
    { id: string; url: string }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const sessionIdsRef = useRef<Set<string>>(new Set());
  const submittedRef = useRef(false);

  // 역할 수준에서만 막는다. "자기 글만" 여부는 서버가 최종 판단한다.
  const canWrite = hasAnyRole(["ADMIN", "MANAGER", "BLOG_MANAGER"]);

  useEffect(() => {
    if (authLoading || canWrite) return;
    router.replace(`/blog/${id}`);
  }, [authLoading, canWrite, router, id]);

  useEffect(() => {
    getBlogPostById(id).then((post) => {
      if (!post) return;
      setForm({
        title: post.title,
        subtitle: post.subtitle ?? "",
        description: post.description,
        thumbnailUrl: post.thumbnailUrl,
        category: post.category,
      });
      if (post.thumbnailUrl) setShowImagePicker(true);
    });
  }, [id]);

  // Sync textarea heights after form loads
  useEffect(() => {
    if (!form) return;
    if (titleRef.current) autoResize(titleRef.current);
    if (subtitleRef.current) autoResize(subtitleRef.current);
  }, [form?.title, form?.subtitle]);

  useEffect(() => {
    return () => {
      if (submittedRef.current) return;
      sessionIdsRef.current.forEach((imgId) =>
        deleteImage(imgId).catch(() => {}),
      );
    };
  }, []);

  const set = (field: keyof BlogRequest, value: string) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleImageUploaded = useCallback((imgId: string, url: string) => {
    sessionIdsRef.current.add(imgId);
    setUploadedImages((prev) => [...prev, { id: imgId, url }]);
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
    setForm((prev) =>
      prev
        ? {
            ...prev,
            thumbnailUrl:
              prev.thumbnailUrl && !imageUrlSet.has(prev.thumbnailUrl)
                ? (imageUrls[0] ?? "")
                : prev.thumbnailUrl,
          }
        : prev,
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await updateBlogPost(id, form);
      router.push(`/blog/${id}`);
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
    }
  };

  if (!form) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6">
        <div className="h-10 w-40 bg-muted animate-pulse rounded mb-8" />
        <div className="h-12 bg-muted animate-pulse rounded mb-3" />
        <div className="h-6 bg-muted animate-pulse rounded w-2/3 mb-8" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </main>
    );
  }

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
          onClick={() => router.push(`/blog/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">돌아가기</span>
        </Button>

        <div className="flex items-center gap-3">
          {/* Category pills */}
          <div className="flex gap-1">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => set("category", value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  form.category === value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Thumbnail toggle */}
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
            {submitting ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* Document area */}
      <div className="space-y-1">
        {/* Title */}
        <textarea
          ref={titleRef}
          rows={1}
          value={form.title}
          onChange={(e) => {
            set("title", e.target.value);
            autoResize(e.target);
          }}
          placeholder="제목"
          className="w-full resize-none overflow-hidden bg-transparent border-none outline-none text-4xl sm:text-6xl font-light tracking-tight placeholder:text-muted-foreground/30 leading-tight"
        />

        {/* Subtitle */}
        <textarea
          ref={subtitleRef}
          rows={1}
          value={form.subtitle}
          onChange={(e) => {
            set("subtitle", e.target.value);
            autoResize(e.target);
          }}
          placeholder="부제목"
          className="w-full resize-none overflow-hidden bg-transparent border-none outline-none text-lg text-muted-foreground placeholder:text-muted-foreground/30 leading-snug"
        />
      </div>

      {/* Thumbnail picker (toggle) */}
      {showImagePicker && uploadedImages.length > 0 && (
        <div className="mt-4">
          <UploadedImagePicker
            images={uploadedImages}
            selectedUrl={form.thumbnailUrl}
            onSelect={(url) => set("thumbnailUrl", url)}
          />
        </div>
      )}

      {/* Divider */}
      <div className="my-6 border-t" />

      {/* Body editor */}
      <NotionEditor
        value={form.description}
        onChange={(description) => set("description", description)}
        onImageUpload={uploadImage}
        onImageUploaded={handleImageUploaded}
        onImageUrlsChange={handleBodyImageUrlsChange}
      />
    </form>
    </main>
  );
}
