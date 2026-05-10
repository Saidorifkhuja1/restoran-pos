"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/client/App";
import { AuthBootstrap } from "@/client/components/AuthBootstrap";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function ClientApp() {
  const [mounted, setMounted] = useState(false);

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
      <BrowserRouter>
        <AuthBootstrap>
          <App />
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
