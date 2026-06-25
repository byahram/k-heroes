"use client";

import { SitePageShell } from "@/components/layout/site-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export function ClassDetailLoadingState() {
  return (
    <SitePageShell>
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-4 h-10 w-72 max-w-full" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />

        <div
          className="mt-8 rounded-xl border p-5 sm:p-6"
          style={{
            borderColor: "rgba(42,66,50,0.12)",
            background: "rgba(253,250,244,0.8)",
          }}
        >
          <Skeleton className="h-5 w-44" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>

        <Skeleton className="mt-6 h-12 rounded-xl" />
        <Skeleton className="mt-5 h-72 rounded-xl" />
      </div>
    </SitePageShell>
  );
}
