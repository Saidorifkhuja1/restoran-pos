"use client";

import { useEffect, useState } from "react";

export function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      setNeedRefresh(true);
    });
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Yangi versiya tayyor</div>
          <div className="text-xs text-slate-500">POS ekranini yangilab oling.</div>
        </div>
        <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()}>
          Yangilash
        </button>
      </div>
    </div>
  );
}
