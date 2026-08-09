"use client";

import type { ReactNode } from "react";
import { Eyebrow } from "@/components/noir";

export function CreateFormSection({
  eyebrow,
  hint,
  children,
}: {
  eyebrow: string;
  hint?: string;
  children: ReactNode;
}) {
  const sectionId = `section-${eyebrow.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section className="space-y-4" aria-labelledby={sectionId}>
      <div>
        <div id={sectionId}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        {hint ? <p className="text-[11.5px] text-text-tertiary mt-1 leading-snug">{hint}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[11px] text-danger mt-1">
      {message}
    </p>
  );
}
