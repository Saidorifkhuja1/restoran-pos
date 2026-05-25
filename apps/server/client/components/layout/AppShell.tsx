"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Globe, Moon, Sun } from "lucide-react";
import { apiClient } from "@/client/api/client";
import { useRealtimeInvalidation } from "@/client/hooks/useRealtimeInvalidation";
import { useAuthStore } from "@/client/store/authStore";
import { dictionary, Language, usePreferencesStore } from "@/client/store/preferencesStore";

type ProfilePanel = "profile" | null;

const iconButtonClass = "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-contrast)] shadow-sm transition-all active:scale-95";
const languageOptions: { value: Language; label: string }[] = [
  { value: "uz", label: "O'zbek" },
  { value: "ru", label: "Русский" },
];

export function AppShell({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hydrated } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<"language" | null>(null);
  const [profilePanel, setProfilePanel] = useState<ProfilePanel>(null);
  const { settings, updateSettings } = usePreferencesStore();
  const { language, themeMode } = settings;
  const t = dictionary[language];
  const [resolvedDark, setResolvedDark] = useState(false);
  useRealtimeInvalidation();
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
  function handleBack() {
    if (window.history.length > 1) router.back();
    else router.push("/tables");
  }
  const showBackButton = pathname !== "/tables";
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
            {showBackButton ? (
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-400 bg-white text-xl leading-none text-slate-800 shadow-sm hover:bg-slate-100"
                aria-label={t.back}
                onClick={handleBack}
              >
                ←
              </button>
            ) : null}
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
          <div className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)] shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold">{t.profile}</div>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-lg text-[var(--color-text)]" aria-label="Yopish" onClick={closePanel}>×</button>
            </div>
            {profilePanel === "profile" ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">{t.name}</div><div className="font-medium">{user?.name}</div></div>
                <div className="rounded-md border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">{t.role}</div><div className="font-medium">{user?.role}</div></div>
                <div className="rounded-md border border-[var(--color-border)] p-3"><div className="text-xs text-[var(--color-muted)]">{t.phone}</div><div className="font-medium">{user?.phone || "-"}</div></div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
