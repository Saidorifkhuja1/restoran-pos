"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft } from "lucide-react";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold tracking-normal text-[var(--color-text)]">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm font-medium text-[var(--color-muted)]">{subtitle}</p> : null}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${className || ""}`}>{children}</section>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "yellow" | "red" | "blue" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return <span className={`rounded px-2 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <Dialog.Close
            aria-label="Orqaga"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
            title="Orqaga"
          >
            <ArrowLeft size={18} />
          </Dialog.Close>
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
        </div>
        {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
