"use client";

import { useEffect, useRef } from "react";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { AuthRestaurant, AuthUser, useAuthStore } from "@/client/store/authStore";

type MeResponse = {
  user: AuthUser;
  restaurant: AuthRestaurant | null;
};

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const logout = useAuthStore((state) => state.logout);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) {
      return undefined;
    }
    bootstrapped.current = true;
    setHydrated(false);
    let mounted = true;
    apiClient
      .get<ApiEnvelope<MeResponse>>("/auth/me")
      .then((response) => {
        if (!mounted) return;
        setAuth({
          user: response.data.data.user,
          restaurant: response.data.data.restaurant,
        });
      })
      .catch(() => {
        if (mounted) {
          logout();
          setHydrated(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [logout, setAuth, setHydrated]);

  return <>{children}</>;
}
