"use client";

import { ClientProviders } from "@/client/components/ClientProviders";

export function PublicPage({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
