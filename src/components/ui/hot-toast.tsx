"use client";

import type { CSSProperties } from "react";
import { Toaster } from "react-hot-toast";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const toastShellBase: CSSProperties = {
  borderRadius: "0.5rem",
  padding: "12px 16px",
  fontSize: "0.8125rem",
  boxShadow:
    "0 1px 2px oklch(18% 0.02 260 / 0.04), 0 8px 24px -8px oklch(18% 0.02 260 / 0.12)",
  maxWidth: "420px",
};

export type ToastSemanticVariant = "success" | "error" | "warning" | "info" | "loading" | "default";

const semanticToastShell: Record<ToastSemanticVariant, CSSProperties> = {
  default: {
    background: "oklch(var(--panel))",
    color: "oklch(var(--foreground))",
    border: "1px solid oklch(var(--border))",
  },
  success: {
    background: "oklch(var(--success-light))",
    color: "oklch(var(--success-text))",
    border: "1px solid oklch(var(--success) / 0.2)",
    borderLeftWidth: "3px",
    borderLeftColor: "oklch(var(--success))",
  },
  error: {
    background: "oklch(var(--danger-light))",
    color: "oklch(var(--danger-text))",
    border: "1px solid oklch(var(--danger) / 0.2)",
    borderLeftWidth: "3px",
    borderLeftColor: "oklch(var(--danger))",
  },
  warning: {
    background: "oklch(var(--warning-light))",
    color: "oklch(var(--warning-text))",
    border: "1px solid oklch(var(--warning) / 0.2)",
    borderLeftWidth: "3px",
    borderLeftColor: "oklch(var(--warning))",
  },
  info: {
    background: "oklch(var(--info-light))",
    color: "oklch(var(--info-text))",
    border: "1px solid oklch(var(--info) / 0.2)",
    borderLeftWidth: "3px",
    borderLeftColor: "oklch(var(--info))",
  },
  loading: {
    background: "oklch(var(--panel))",
    color: "oklch(var(--foreground))",
    border: "1px solid oklch(var(--border))",
    borderLeftWidth: "3px",
    borderLeftColor: "oklch(var(--blue-500))",
  },
};

/** Central semantic shell styles for react-hot-toast variants. */
export function getToastVariantStyle(variant: ToastSemanticVariant): CSSProperties {
  return { ...toastShellBase, ...semanticToastShell[variant] };
}

type ToastIconVariant = "success" | "error" | "warning" | "info" | "loading";

const variantIconStyles: Record<ToastIconVariant, { shell: string; icon: string }> = {
  success: { shell: "border border-success/25 bg-panel/90", icon: "text-success-text" },
  error: { shell: "border border-danger/25 bg-panel/90", icon: "text-danger-text" },
  warning: { shell: "border border-warning/25 bg-panel/90", icon: "text-warning-text" },
  info: { shell: "border border-info/25 bg-panel/90", icon: "text-info-text" },
  loading: { shell: "border border-blue-200 bg-panel/90", icon: "text-brand" },
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
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        styles.shell,
      )}
      aria-hidden
    >
      <Icon
        className={cn("h-3.5 w-3.5", styles.icon, spin && "animate-spin")}
        strokeWidth={2.25}
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

export function HotToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={10}
      containerStyle={{
        top: "calc(var(--shell-sticky-top) + 0.5rem)",
        right: 16,
      }}
      toastOptions={{
        duration: 4500,
        style: getToastVariantStyle("default"),
        success: {
          duration: 4000,
          style: getToastVariantStyle("success"),
          icon: successToastIcon(),
        },
        error: {
          duration: 6000,
          style: getToastVariantStyle("error"),
          icon: errorToastIcon(),
        },
        loading: {
          style: getToastVariantStyle("loading"),
          icon: loadingToastIcon(),
        },
        blank: {
          style: getToastVariantStyle("info"),
          icon: infoToastIcon(),
        },
      }}
    />
  );
}
