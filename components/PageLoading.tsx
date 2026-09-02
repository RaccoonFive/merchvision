"use client";

import { AppShell } from "@/components/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";

type PageLoadingProps = {
  activePath: "/favorites" | "/investment-tracker" | "/account";
  label: string;
  title: string;
};

export function PageLoading({ activePath, label, title }: PageLoadingProps) {
  return (
    <AppShell activePath={activePath} title={title}>
      {() => (
        <section aria-label={label} className="page-loading-panel">
          <LoadingSpinner label={label} />
        </section>
      )}
    </AppShell>
  );
}
