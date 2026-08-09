"use client";

import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "";

interface SEOProps {
  title: string;
  description: string;
  path: string;
}

export function SEO({ title, description, path }: SEOProps) {
  const url = BASE ? `${BASE.replace(/\/$/, "")}${path}` : path;

  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("description", description);
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    if (BASE) {
      setMeta("og:url", url, true);
    }
    setMeta("og:type", "website", true);
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    if (BASE) {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = url;
    }
  }, [title, description, url]);

  return null;
}
