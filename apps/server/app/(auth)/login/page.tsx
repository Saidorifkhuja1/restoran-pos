import { PublicPage } from "@/client/components/ProtectedPage";
import { AdminLogin } from "@/client/pages/Admin/Login";

export default function LoginPage() {
  return (
    <PublicPage>
      <AdminLogin />
    </PublicPage>
  );
}
