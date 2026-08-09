"use client";

import { redirect } from "next/navigation";

/** Render-time navigation redirect (avoids useEffect flash). */
export function RedirectTo({ href }: { href: string }): never {
  redirect(href);
}
