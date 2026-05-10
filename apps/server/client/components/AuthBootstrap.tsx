import { useEffect } from "react";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { AuthRestaurant, AuthUser, useAuthStore } from "@/client/store/authStore";

type MeResponse = {
  user: AuthUser;
  restaurant: AuthRestaurant | null;
};

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setHydrated = useAuthStore((state) => state.setHydrated);

  useEffect(() => {
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
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, [setAuth, setHydrated]);

  return <>{children}</>;
}
