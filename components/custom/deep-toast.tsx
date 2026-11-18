"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { toast, type ExternalToast } from "sonner";
import { cn } from "@/lib/utils";
import styles from "./deep-toast.module.css";

/** Toasts for the public deep-green pages, styled like an M3 snackbar in the site tone.
 *  The global <Toaster> keeps its default look for the member app. */
function show(kind: "success" | "error", message: string, options?: ExternalToast) {
  return toast(message, {
    position: "bottom-center",
    unstyled: true,
    icon:
      kind === "success" ? (
        <CircleCheck className="size-5" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-5" aria-hidden="true" />
      ),
    classNames: {
      toast: cn(styles.toast, styles[kind]),
      title: styles.title,
      icon: styles.icon,
    },
    ...options,
  });
}

export const deepToast = {
  success: (message: string, options?: ExternalToast) => show("success", message, options),
  error: (message: string, options?: ExternalToast) => show("error", message, options),
};
