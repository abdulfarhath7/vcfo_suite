"use client";

import { useEffect } from "react";
import toast, { ToastBar, Toaster, useToasterStore } from "react-hot-toast";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getToastVariantStyle } from "@/lib/toast-style";

type ToastIconVariant = "success" | "error" | "warning" | "info" | "loading";

const variantIconStyles: Record<ToastIconVariant, { shell: string; icon: string }> = {
  success: { shell: "bg-positive-soft", icon: "text-positive" },
  error: { shell: "bg-danger-soft", icon: "text-danger" },
  warning: { shell: "bg-warning-soft", icon: "text-warning" },
  info: { shell: "bg-info-soft", icon: "text-info" },
  loading: { shell: "bg-brand-soft", icon: "text-brand" },
};

function ToastStatusIcon({
  variant,
  Icon,
  spin = false,
}: {
  variant: ToastIconVariant;
  Icon: LucideIcon;
  spin?: boolean;
}) {
  const styles = variantIconStyles[variant];
  return (
    <span
      className={cn(
        "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-mark",
        styles.shell,
      )}
      aria-hidden
    >
      <Icon
        className={cn("h-3.5 w-3.5", styles.icon, spin && "animate-spin")}
        strokeWidth={1.6}
        aria-hidden
      />
    </span>
  );
}

function successToastIcon() {
  return <ToastStatusIcon variant="success" Icon={CheckCircle2} />;
}

function errorToastIcon() {
  return <ToastStatusIcon variant="error" Icon={AlertCircle} />;
}

export function warningToastIcon() {
  return <ToastStatusIcon variant="warning" Icon={AlertTriangle} />;
}

export function infoToastIcon() {
  return <ToastStatusIcon variant="info" Icon={Info} />;
}

function loadingToastIcon() {
  return <ToastStatusIcon variant="loading" Icon={Loader2} spin />;
}

/** GL-02: at most three toasts show at one time; the oldest goes first. */
export const TOAST_LIMIT = 3;
/** GL-02: a toast closes after 3 seconds; an error (and a toast with Undo) stays 6 seconds. */
export const TOAST_MS = 3000;
export const TOAST_ERROR_MS = 6000;

/** The ids to close so that only the newest `limit` visible toasts stay. Newest first in `toasts`. */
export function toastsOverLimit<T extends { id: string; visible: boolean }>(toasts: T[], limit = TOAST_LIMIT): string[] {
  return toasts
    .filter((t) => t.visible)
    .slice(limit)
    .map((t) => t.id);
}

export function HotToaster() {
  // The store lists the newest toast first, so everything after the third visible one is older.
  const { toasts } = useToasterStore();
  useEffect(() => {
    for (const id of toastsOverLimit(toasts)) toast.dismiss(id);
  }, [toasts]);

  return (
    <Toaster
      position="bottom-left"
      gutter={10}
      containerStyle={{
        top: "calc(var(--shell-sticky-top) + 0.5rem)",
        right: 16,
        /* Bottom left beside the sidebar (prototype UndoToast); on phones above the tab bar.
           See --toast-left and --toast-bottom in globals.css. */
        left: "var(--toast-left, 16px)",
        bottom: "var(--toast-bottom, 24px)",
      }}
      toastOptions={{
        duration: TOAST_MS,
        style: getToastVariantStyle("default"),
        success: {
          duration: TOAST_MS,
          style: getToastVariantStyle("success"),
          icon: successToastIcon(),
        },
        error: {
          duration: TOAST_ERROR_MS,
          style: getToastVariantStyle("error"),
          icon: errorToastIcon(),
        },
        loading: {
          style: getToastVariantStyle("loading"),
          icon: loadingToastIcon(),
        },
        blank: {
          duration: TOAST_MS,
          style: getToastVariantStyle("info"),
          icon: infoToastIcon(),
        },
      }}
    >
      {/* Every toast has a close X, and the timer stops while the pointer is on the stack
          (GL-02). A loading toast closes itself when the work ends. Custom toasts (undo,
          saved) draw their own X. */}
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              {t.type !== "loading" ? (
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  aria-label="Close notification"
                  className="-mr-1 ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}
