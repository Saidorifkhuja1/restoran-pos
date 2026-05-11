import { ClientProviders } from "@/client/components/ClientProviders";
import { requirePageRole } from "@/lib/page-auth";
import { UserRole } from "@restopos/types";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]);
  return <ClientProviders>{children}</ClientProviders>;
}
