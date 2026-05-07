import { Navigate, useLocation } from "react-router-dom";
import { AuthRole, useAuthStore } from "@/store/authStore";

type AuthGuardProps = {
  roles: AuthRole[];
  children: React.ReactNode;
};

export function AuthGuard({ roles, children }: AuthGuardProps) {
  const location = useLocation();
  const { user, hydrated } = useAuthStore();

  if (!hydrated) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Yuklanmoqda...</div>;
  }

  if (!user) {
    return <Navigate to={roles.includes("SUPERADMIN") ? "/superadmin/login" : "/login"} replace state={{ from: location }} />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={defaultPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

export function defaultPathForRole(role: AuthRole): string {
  if (role === "SUPERADMIN") return "/superadmin";
  if (role === "KITCHEN") return "/kitchen";
  if (role === "CASHIER") return "/cashier";
  if (role === "ADMIN" || role === "MANAGER") return "/admin";
  return "/tables";
}
