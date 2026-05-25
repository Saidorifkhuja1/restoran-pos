import { ClientProviders } from "@/client/components/ClientProviders";
import { requirePageRole } from "@/lib/page-auth";
import { UserRole } from "@restopos/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole([UserRole.ADMIN, UserRole.MANAGER]);
  return <ClientProviders>{children}</ClientProviders>;
}
