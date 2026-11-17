"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { Notice } from "@/lib/interfaces/notice";
import { formatDotDate } from "@/lib/utils/date-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useNoticeUnread } from "@/lib/contexts/NoticeUnreadContext";
import { toast } from "sonner";
import { useReplayInView } from "./use-replay-in-view";
import styles from "./news-list.module.css";

export function NewsList({
  notices,
  variant = "default",
}: {
  notices: Notice[];
  /** "deep": numbered rows with dashed dividers for the deep-green home. */
  variant?: "default" | "deep";
}) {
  const { isAuthenticated } = useAuth();
  const { unreadNoticeIds, markRead } = useNoticeUnread();
  const [selected, setSelected] = useState<Notice | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useReplayInView(listRef);

  function openNotice(notice: Notice) {
    setSelected(notice);
    if (!isAuthenticated || !unreadNoticeIds.has(notice.id)) return;
    void markRead(notice.id).catch(() => {
      toast.error("공지 읽음 상태를 저장하지 못했습니다.");
    });
  }

  const deep = variant === "deep";

  if (notices.length === 0) {
    return deep ? (
      <p className="border-y border-dashed border-[var(--deep-outline)] py-10 text-lg font-light text-[var(--deep-on-variant)]">
        등록된 소식이 없습니다.
      </p>
    ) : (
      <div className="mx-auto mt-10 w-[90%] max-w-[1045px] overflow-hidden rounded-[26px] bg-white/50 py-12 text-center text-[#929191] shadow-[0_1px_73px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        등록된 소식이 없습니다.
      </div>
    );
  }

  const dialog = (
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{selected?.title}</DialogTitle>
          <DialogDescription>
            {selected?.tag} · {selected && (
              <time className="font-cnu-numeric" dateTime={selected.createdAt}>{formatDotDate(selected.createdAt)}</time>
            )}
          </DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-line text-sm leading-relaxed text-[#3a4050]">
          {selected?.content}
        </p>
      </DialogContent>
    </Dialog>
  );

  if (deep) {
    return (
      <>
        <ul ref={listRef} className={styles.list}>
          {notices.map((notice, index) => (
            <li
              key={notice.id}
              className={styles.row}
              style={{ "--i": index } as CSSProperties}
            >
              {index === 0 && (
                <span aria-hidden="true" className={`${styles.rule} ${styles.ruleTop}`} />
              )}
              <button
                onClick={() => openNotice(notice)}
                className="group grid w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-6 text-left sm:grid-cols-[96px_minmax(0,1fr)_auto_140px] sm:gap-6 sm:py-[30px]"
              >
                <span className={`${styles.mask} font-cnu-numeric text-sm text-[var(--deep-on-variant)]`}>
                  <span className={styles.rise}>{String(index + 1).padStart(2, "0")}</span>
                </span>
                <span className={`${styles.mask} text-xl font-light transition-colors group-hover:text-[var(--deep-accent)] sm:text-[30px] sm:leading-[1.3]`}>
                  <span className={`${styles.rise} flex min-w-0 items-center gap-2`}>
                    <span className="truncate">{notice.title}</span>
                    {isAuthenticated && unreadNoticeIds.has(notice.id) && (
                      <span className="size-2 shrink-0 rounded-full bg-[var(--deep-accent)]" />
                    )}
                  </span>
                </span>
                <span className={`${styles.fade} col-start-2 flex h-8 w-fit items-center rounded-lg border border-[var(--deep-outline)] px-4 text-sm font-medium sm:col-start-auto`}>
                  {notice.tag}
                </span>
                <time dateTime={notice.createdAt} className={`${styles.fade} font-cnu-numeric hidden text-right text-sm text-[var(--deep-on-variant)] sm:block`}>
                  {formatDotDate(notice.createdAt)}
                </time>
              </button>
              <span aria-hidden="true" className={styles.rule} />
            </li>
          ))}
        </ul>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className="mx-auto mt-10 w-[90%] max-w-[1045px] overflow-hidden rounded-[26px] bg-white/50 shadow-[0_1px_73px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        {notices.map((notice) => (
          <button
            key={notice.id}
            onClick={() => openNotice(notice)}
            className="group relative grid min-h-[77px] w-full cursor-pointer grid-cols-[59px_minmax(0,1fr)_20px] items-center gap-3.5 border-b border-[#d8d8d8] px-4 text-left transition-colors last:border-b-0 hover:bg-[#37825d]/[0.06] sm:min-h-[89px] sm:grid-cols-[81px_minmax(0,1fr)_178px_20px] sm:gap-8 sm:px-[41px]"
          >
            <span className="flex h-9 items-center justify-center rounded-full bg-[#37825d] text-xs text-white sm:h-[37px] sm:text-lg">
              {notice.tag}
            </span>
            <span className="flex min-w-0 items-center gap-2 text-sm transition-colors sm:text-xl group-hover:text-[#215a3f]">
              <span className="truncate">{notice.title}</span>
              {isAuthenticated && unreadNoticeIds.has(notice.id) && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
              )}
            </span>
            <time dateTime={notice.createdAt} className="font-cnu-numeric hidden text-center text-xl text-[#929191] sm:block sm:translate-x-10">
              {formatDotDate(notice.createdAt)}
            </time>
            <ChevronRight className="h-4 w-4 -translate-x-1 text-[#37825d] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>

      {dialog}
    </>
  );
}
