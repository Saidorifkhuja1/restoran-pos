import { ClientProviders } from "@/client/components/ClientProviders";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders allowedRoles={["SUPERADMIN"]} loginPath="/superadmin/login">
      {children}
    </ClientProviders>
  );
}
