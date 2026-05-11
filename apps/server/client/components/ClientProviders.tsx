"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthBootstrap } from "@/client/components/AuthBootstrap";

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

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    setMounted(true);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  if (!mounted) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Yuklanmoqda...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}

