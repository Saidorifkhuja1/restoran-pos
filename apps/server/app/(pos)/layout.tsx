import { ClientProviders } from "@/client/components/ClientProviders";
import { AppShell } from "@/client/components/layout/AppShell";
import { UserRole } from "@restopos/types";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders
      allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER]}
      loginPath="/login"
    >
      <AppShell>{children}</AppShell>
    </ClientProviders>
  );
}
