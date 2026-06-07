"use client";

import { useEffect, useMemo, useRef } from "react";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { AuthRestaurant, AuthRole, AuthUser, useAuthStore } from "@/client/store/authStore";

type MeResponse = {
  user: AuthUser;
  restaurant: AuthRestaurant | null;
};

type AuthBootstrapProps = {
  allowedRoles?: AuthRole[];
  children: React.ReactNode;
  loginPath?: string;
};

export function AuthBootstrap({
  allowedRoles,
  children,
  loginPath = "/login",
}: AuthBootstrapProps) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const validatedKey = useRef<string | null>(null);
  const rolesKey = useMemo(() => allowedRoles?.join("|") ?? "*", [allowedRoles]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }
    if (!token) {
      logout();
      setHydrated(true);
      window.location.replace(loginPath);
      return undefined;
    }

    const authKey = `${token}:${rolesKey}`;
    if (validatedKey.current === authKey) {
      return undefined;
    }

    let mounted = true;
    apiClient
      .get<ApiEnvelope<MeResponse>>("/auth/me")
      .then((response) => {
        if (!mounted) return;
        if (allowedRoles && !allowedRoles.includes(response.data.data.user.role)) {
          logout();
          setHydrated(true);
          window.location.replace(loginPath);
          return;
        }

        setAuth({
          user: response.data.data.user,
          restaurant: response.data.data.restaurant,
          token,
        });
        validatedKey.current = authKey;
      })
      .catch(() => {
        if (mounted) {
          logout();
          setHydrated(true);
          window.location.replace(loginPath);
        }
      });
    return () => {
      mounted = false;
    };
  }, [allowedRoles, hydrated, loginPath, logout, rolesKey, setAuth, setHydrated, token, user]);

  const isAllowed = Boolean(
    hydrated && user && (!allowedRoles || allowedRoles.includes(user.role))
  );

  if (!isAllowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050916] text-white">
        <div className="text-sm font-bold text-slate-300">Yuklanmoqda...</div>
      </div>
    );
  }

  return <>{children}</>;
}
