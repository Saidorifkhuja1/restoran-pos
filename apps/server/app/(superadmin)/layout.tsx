import { ClientProviders } from "@/client/components/ClientProviders";
import { requirePageRole } from "@/lib/page-auth";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["SUPERADMIN"]);
  return <ClientProviders>{children}</ClientProviders>;
}
