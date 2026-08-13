"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

const NotFound = () => {
  const pathname = usePathname();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">This page isn’t in your workspace</p>
        <p className="mb-6 text-sm text-muted-foreground">
          The link may be outdated, or you may not have access to this area.
        </p>
        <Link href="/" className="text-primary underline hover:text-primary/90">
          Back to sign-in
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
