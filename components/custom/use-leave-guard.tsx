"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeepConfirmDialog } from "./deep-confirm-dialog";

/**
 * Warns before leaving a page with unsaved changes.
 * - Reload, tab close and typed URLs: the browser's own beforeunload prompt.
 * - Links inside the site (header, crumbs, footer): a DeepConfirmDialog.
 * - Buttons that navigate in code: wrap the navigation with `confirmLeave`.
 */
export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    // Capture phase, so it runs before Next.js <Link> starts a client-side navigation.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingLeave(() => () => router.push(`${url.pathname}${url.search}${url.hash}`));
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, router]);

  /** Runs `leave` right away, or after the user confirms when there are unsaved changes. */
  const confirmLeave = (leave: () => void) => {
    if (activeRef.current) setPendingLeave(() => leave);
    else leave();
  };

  const leaveDialog = (
    <DeepConfirmDialog
      open={pendingLeave !== null}
      onOpenChange={(open) => {
        if (!open) setPendingLeave(null);
      }}
      title="저장하지 않고 나갈까요?"
      description="변경한 답변은 저장되지 않습니다."
      cancelLabel="계속 수정"
      confirmLabel="나가기"
      destructive
      onConfirm={() => {
        const leave = pendingLeave;
        setPendingLeave(null);
        leave?.();
      }}
    />
  );

  return { confirmLeave, leaveDialog };
}
