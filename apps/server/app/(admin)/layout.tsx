import { ClientProviders } from "@/client/components/ClientProviders";
import { AppShell } from "@/client/components/layout/AppShell";
import { requirePageRole } from "@/lib/page-auth";
import { UserRole } from "@restopos/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole([UserRole.ADMIN, UserRole.MANAGER]);
  return (
    <ClientProviders>
      <AppShell>{children}</AppShell>
    </ClientProviders>
  );
}
