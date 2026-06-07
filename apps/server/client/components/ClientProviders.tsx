"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthBootstrap } from "@/client/components/AuthBootstrap";
import { useRealtimeInvalidation } from "@/client/hooks/useRealtimeInvalidation";
import { AuthRole } from "@/client/store/authStore";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

type ClientProvidersProps = {
  allowedRoles?: AuthRole[];
  children: React.ReactNode;
  loginPath?: string;
};

function RealtimeBridge() {
  useRealtimeInvalidation();
  return null;
}

export function ClientProviders({
  allowedRoles,
  children,
  loginPath,
}: ClientProvidersProps) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!("serviceWorker" in navigator)) return;

    const cleanupKey = "restopos-dev-sw-cleaned";
    if (sessionStorage.getItem(cleanupKey) === "1") return;

    async function clearDevServiceWorker() {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) {
        sessionStorage.setItem(cleanupKey, "1");
        return;
      }

      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      sessionStorage.setItem(cleanupKey, "1");
      window.location.reload();
    }

    clearDevServiceWorker().catch(() => {
      sessionStorage.setItem(cleanupKey, "1");
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap allowedRoles={allowedRoles} loginPath={loginPath}>
        <RealtimeBridge />
        {children}
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
