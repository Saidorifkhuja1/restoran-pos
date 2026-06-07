"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe, Moon, ReceiptText, Sun } from "lucide-react";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { orderDisplayStatusLabel } from "@/client/lib/order-status";
import { useAuthStore } from "@/client/store/authStore";
import { dictionary, Language, usePreferencesStore } from "@/client/store/preferencesStore";
import { UserRole } from "@restopos/types";

type ProfilePanel = "profile" | "receipts" | null;
type ReceiptPeriod = "day" | "week" | "month" | "year";
type WaiterReceipt = {
  id: string;
  orderNumber: number;
  status: string;
  createdAt: string;
  table: { number: number; zone: { name: string } };
  items: { id: string; name: string; price: number; quantity: number; status: string }[];
};

function isReceiptInPeriod(createdAt: string, period: ReceiptPeriod): boolean {
  const date = new Date(createdAt);
  const now = new Date();
  if (period === "day") return date.toDateString() === now.toDateString();
  if (period === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (period === "year") return date.getFullYear() === now.getFullYear();
  const start = new Date(now);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

function receiptTotal(receipt: WaiterReceipt): number {
  return receipt.items
    .filter((item) => item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const iconButtonClass = "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-contrast)] shadow-sm transition-all active:scale-95";
const languageOptions: { value: Language; label: string }[] = [
  { value: "uz", label: "O'zbek" },
  { value: "ru", label: "Русский" },
];

export function AppShell({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { user, logout, hydrated } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<"language" | null>(null);
  const [profilePanel, setProfilePanel] = useState<ProfilePanel>(null);
  const [receiptPeriod, setReceiptPeriod] = useState<ReceiptPeriod>("day");
  const { settings, updateSettings } = usePreferencesStore();
  const { language, themeMode } = settings;
  const t = dictionary[language];
  const [resolvedDark, setResolvedDark] = useState(false);
  const waiterReceipts = useQuery({
    queryKey: ["waiter-profile-receipts", user?.id],
    enabled: profilePanel === "receipts" && user?.role === UserRole.WAITER,
    queryFn: () => getData<Paginated<WaiterReceipt>>("/orders?limit=200"),
  });
  const filteredReceipts = useMemo(
    () => (waiterReceipts.data?.items ?? []).filter((receipt) => isReceiptInPeriod(receipt.createdAt, receiptPeriod)),
    [receiptPeriod, waiterReceipts.data?.items]
  );
  useEffect(() => {
    if (user?.role === "SUPERADMIN") {
      router.replace("/superadmin/dashboard");
    }
  }, [router, user?.role]);
  async function handleLogout() {
    await apiClient.post("/auth/logout").catch(() => undefined);
    logout();
    setProfileOpen(false);
    setSettingsOpen(null);
    setProfilePanel(null);
    window.location.href = "/login";
  }
  function openPanel(panel: Exclude<ProfilePanel, null>) {
    setProfilePanel(panel);
    setProfileOpen(false);
  }
  function closePanel() {
    setProfilePanel(null);
  }
  useEffect(() => {
    if (themeMode === "auto") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
      return;
    }
    setResolvedDark(themeMode === "dark");
    document.documentElement.classList.toggle("dark", themeMode === "dark");
  }, [themeMode]);

  if (!hydrated || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050916] text-white">
        <div className="text-sm font-bold text-slate-300">Yuklanmoqda...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-300 bg-white/95 px-5 shadow-sm backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-semibold">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.role}</div>
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            <button
              className={iconButtonClass}
              aria-label="Theme"
              onClick={() => {
                updateSettings({ themeMode: resolvedDark ? "light" : "dark" });
                setSettingsOpen(null);
                setProfileOpen(false);
              }}
            >
              {resolvedDark ? <Sun size={20} strokeWidth={2.6} /> : <Moon size={20} strokeWidth={2.6} />}
            </button>
            <button
              className={iconButtonClass}
              aria-label="Til"
              onClick={() => {
                setSettingsOpen((open) => open === "language" ? null : "language");
                setProfileOpen(false);
              }}
            >
              <Globe size={20} strokeWidth={2.6} />
            </button>
            <button
              className={iconButtonClass}
              aria-label="Profil menyusi"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((open) => !open);
                setSettingsOpen(null);
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-11 z-20 w-44 rounded-md border border-slate-300 bg-white py-1 shadow-lg">
                <button className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => openPanel("profile")}>
                  {t.profile}
                </button>
                {user.role === UserRole.WAITER ? (
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => openPanel("receipts")}>
                    <ReceiptText size={16} /> Cheklar
                  </button>
                ) : null}
                <button className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50" onClick={handleLogout}>
                  {t.logout}
                </button>
              </div>
            ) : null}
            {settingsOpen === "language" ? (
              <div className="absolute right-12 top-11 z-[100] mt-2 w-40 overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
                <div className="flex flex-col">
                {languageOptions.map((lang) => (
                  <button
                    className={
                      language === lang.value
                        ? "flex items-center px-5 py-3 text-left text-[14px] font-bold text-[var(--color-primary-contrast)] transition-colors bg-[var(--color-primary)]"
                        : "flex items-center px-5 py-3 text-left text-[14px] font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface2)]"
                    }
                    key={lang.value}
                    onClick={() => {
                      updateSettings({ language: lang.value });
                      setSettingsOpen(null);
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
                </div>
              </div>
            ) : null}
          </div>
        </header>
        <main className="px-5 py-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      {profilePanel ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)] shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]" aria-label="Orqaga" onClick={closePanel}>
                <ArrowLeft size={18} />
              </button>
              <div className="text-lg font-semibold">{profilePanel === "receipts" ? "Cheklar" : t.profile}</div>
            </div>
            {profilePanel === "profile" ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">{t.name}</div><div className="font-medium">{user?.name}</div></div>
                <div className="rounded-md border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">{t.role}</div><div className="font-medium">{user?.role}</div></div>
                <div className="rounded-md border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">{t.phone}</div><div className="font-medium">{user?.phone || "-"}</div></div>
              </div>
            ) : null}
            {profilePanel === "receipts" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {([
                    ["day", "Kun"],
                    ["week", "Hafta"],
                    ["month", "Oy"],
                    ["year", "Yil"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      className={receiptPeriod === value ? "rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-primary-contrast)]" : "rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-semibold"}
                      onClick={() => setReceiptPeriod(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {waiterReceipts.isLoading ? <div className="text-sm text-[var(--color-muted)]">Yuklanmoqda...</div> : null}
                {!waiterReceipts.isLoading && filteredReceipts.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[var(--color-border)] p-5 text-center text-sm text-[var(--color-muted)]">Bu davrda chek yo'q</div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredReceipts.map((receipt) => (
                    <div key={receipt.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">#{receipt.orderNumber} · Stol {receipt.table.number}</div>
                          <div className="mt-1 text-xs text-[var(--color-muted)]">{receipt.table.zone.name} · {new Date(receipt.createdAt).toLocaleString("uz-UZ")}</div>
                        </div>
                        <span className="rounded bg-[var(--color-surface2)] px-2 py-1 text-xs font-semibold">{orderDisplayStatusLabel(receipt.status)}</span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        {receipt.items.map((item) => (
                          <div key={item.id} className="flex justify-between gap-3">
                            <span className={item.status === "CANCELLED" ? "line-through opacity-50" : ""}>{item.name} x{item.quantity}</span>
                            <span>{(item.price * item.quantity).toLocaleString("uz-UZ")}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 border-t border-[var(--color-border)] pt-2 text-right font-semibold">{receiptTotal(receipt).toLocaleString("uz-UZ")} UZS</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
