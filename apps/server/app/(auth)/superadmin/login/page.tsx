import { PublicPage } from "@/client/components/ProtectedPage";
import { SuperAdminLogin } from "@/client/pages/SuperAdmin/Login";

export default function SuperAdminLoginPage() {
  return (
    <PublicPage>
      <SuperAdminLogin />
    </PublicPage>
  );
}
