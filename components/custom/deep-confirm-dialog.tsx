"use client";

import type { ReactNode } from "react";
import { AlertDialog as Dialog } from "radix-ui";
import { cn } from "@/lib/utils";
import styles from "./deep-confirm-dialog.module.css";

type DeepConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while `pending`. */
  pendingLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  /** Runs on confirm; the dialog stays open until the caller closes it. */
  onConfirm: () => void;
};

/** Minimal confirm dialog in the deep-green site tone (see the CSS module for the spec). */
export function DeepConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "취소",
  destructive = false,
  pending = false,
  onConfirm,
}: DeepConfirmDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Keep it open while the action is running.
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className={styles.description}>{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <div className={styles.actions}>
            <Dialog.Cancel className={cn(styles.button, styles.cancel)} disabled={pending}>
              {cancelLabel}
            </Dialog.Cancel>
            <Dialog.Action
              className={cn(styles.button, destructive ? styles.destructive : styles.confirm)}
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {pending && pendingLabel ? pendingLabel : confirmLabel}
            </Dialog.Action>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
