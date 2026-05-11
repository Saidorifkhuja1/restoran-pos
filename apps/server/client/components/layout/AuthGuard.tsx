"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthRole, useAuthStore } from "@/client/store/authStore";

type AuthGuardProps = {
  roles: AuthRole[];
  children: React.ReactNode;
};

export function AuthGuard({ roles, children }: AuthGuardProps) {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace(roles.includes("SUPERADMIN") ? "/superadmin/login" : "/login");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(defaultPathForRole(user.role));
    }
  }, [hydrated, roles, router, user]);

  if (!hydrated) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Yuklanmoqda...</div>;
  }

  if (!user) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Yo'naltirilmoqda...</div>;
  }

  if (!roles.includes(user.role)) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Yo'naltirilmoqda...</div>;
  }

  return <>{children}</>;
}

export function defaultPathForRole(role: AuthRole): string {
  if (role === "SUPERADMIN") return "/superadmin/dashboard";
  if (role === "KITCHEN") return "/kitchen";
  if (role === "CASHIER") return "/cashier";
  if (role === "ADMIN" || role === "MANAGER") return "/admin/dashboard";
  return "/tables";
}
