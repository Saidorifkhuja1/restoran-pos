"use client";

import { AppShell } from "@/client/components/layout/AppShell";
import { AuthGuard } from "@/client/components/layout/AuthGuard";
import { ClientProviders } from "@/client/components/ClientProviders";
import { PwaUpdatePrompt } from "@/client/components/PwaUpdatePrompt";
import { AuthRole } from "@/client/store/authStore";

type ProtectedPageProps = {
  roles: AuthRole[];
  shell?: boolean;
  children: React.ReactNode;
};

export function ProtectedPage({ roles, shell = true, children }: ProtectedPageProps) {
  return (
    <ClientProviders>
      <AuthGuard roles={roles}>{shell ? <AppShell>{children}</AppShell> : children}</AuthGuard>
      <PwaUpdatePrompt />
    </ClientProviders>
  );
}

export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders>
      {children}
      <PwaUpdatePrompt />
    </ClientProviders>
  );
}
