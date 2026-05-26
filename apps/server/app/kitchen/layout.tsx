import { ClientProviders } from "@/client/components/ClientProviders";
import { UserRole } from "@restopos/types";

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders allowedRoles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]}>
      {children}
    </ClientProviders>
  );
}
