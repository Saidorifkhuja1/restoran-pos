"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Building2, Crown, Globe, MapPin, Moon, ShieldCheck, Sun } from "lucide-react";
import { apiClient } from "@/client/api/client";
import { Language, usePreferencesStore } from "@/client/store/preferencesStore";

const newRestaurantSchema = z.object({
  name: z.string().min(2, "Restoran nomi kerak"),
  type: z.string().min(2, "Restoran turi kerak"),
  address: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  taxPercent: z.coerce.number().min(0, "QQS 0 dan kichik bo'lmasin").max(100, "QQS 100 dan oshmasin"),
  receiptFooter: z.string().optional(),
  adminName: z.string().min(2, "Admin ismi kerak"),
  adminPhone: z.string().min(5, "Telefon kerak"),
  adminPin: z.string()
    .min(8, "Parol kamida 8 ta belgi bo'lishi kerak")
    .regex(/[A-Z]/, "Parolda katta harf bo'lishi kerak")
    .regex(/[a-z]/, "Parolda kichik harf bo'lishi kerak")
    .regex(/\d/, "Parolda raqam bo'lishi kerak")
    .regex(/[^A-Za-z0-9]/, "Parolda maxsus belgi bo'lishi kerak"),
});

type NewRestaurantForm = z.infer<typeof newRestaurantSchema>;
type MapPoint = { lat: number; lng: number; x: number; y: number };
type MapTile = { x: number; y: number; url: string; left: string; top: string };
const languageOptions: { value: Language; label: string }[] = [
  { value: "uz", label: "O'zbek" },
  { value: "ru", label: "Русский" },
];
const newRestaurantText = {
  uz: {
    title: "Yangi restoran",
    subtitle: "Restoran ma’lumotlari va birinchi admin user",
    back: "Orqaga",
    details: "Restoran details",
    detailsHint: "Dashboard detailda ko‘rinadigan maydonlar",
    name: "Restoran nomi",
    type: "Turi",
    phone: "Telefon",
    address: "Joylashuvi",
    addressPlaceholder: "Manzil yozing yoki xaritadan tanlang",
    mapTitle: "Xaritadan tanlash",
    mapHint: "Nuqtani bosib restoran joylashuvini belgilang",
    myLocation: "Mening joylashuvim",
    clear: "Tozalash",
    selectedCoordinate: "Tanlangan koordinata",
    taxId: "Soliq raqami",
    taxPercent: "QQS foizi",
    receiptFooter: "Chek pastki matni",
    firstAdmin: "Birinchi admin",
    firstAdminHint: "Restoran boshqaruvchisi uchun login parol",
    adminName: "Admin ismi",
    adminPhone: "Admin telefon",
    adminPassword: "Admin parol",
    create: "Restoran yaratish",
    creating: "Yaratilmoqda...",
    createError: "Restoran yaratishda xatolik yuz berdi",
    geoUnsupported: "Brauzer joylashuvni qo‘llab-quvvatlamaydi",
    geoDenied: "Joylashuv ruxsati berilmadi yoki aniqlanmadi",
  },
  ru: {
    title: "Новый ресторан",
    subtitle: "Данные ресторана и первый администратор",
    back: "Назад",
    details: "Данные ресторана",
    detailsHint: "Поля, которые отображаются в деталях",
    name: "Название ресторана",
    type: "Тип",
    phone: "Телефон",
    address: "Расположение",
    addressPlaceholder: "Введите адрес или выберите на карте",
    mapTitle: "Выбор на карте",
    mapHint: "Нажмите точку, чтобы отметить расположение ресторана",
    myLocation: "Моё местоположение",
    clear: "Очистить",
    selectedCoordinate: "Выбранные координаты",
    taxId: "Налоговый номер",
    taxPercent: "НДС",
    receiptFooter: "Текст внизу чека",
    firstAdmin: "Первый админ",
    firstAdminHint: "Логин и пароль для управляющего ресторана",
    adminName: "Имя админа",
    adminPhone: "Телефон админа",
    adminPassword: "Пароль админа",
    create: "Создать ресторан",
    creating: "Создаётся...",
    createError: "Ошибка при создании ресторана",
    geoUnsupported: "Браузер не поддерживает геолокацию",
    geoDenied: "Разрешение на геолокацию не выдано или место не определено",
  },
} as const;

const INITIAL_MAP_CENTER = { lat: 41.311081, lng: 69.240562 };
const MAP_ZOOM = 13;
const TILE_SIZE = 256;

function latLngToWorld(lat: number, lng: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function worldToLatLng(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function getMapTiles(center: { lat: number; lng: number }): { centerWorld: { x: number; y: number }; tiles: MapTile[] } {
  const centerWorld = latLngToWorld(center.lat, center.lng, MAP_ZOOM);
  const tiles = Array.from({ length: 63 }, (_, index) => {
    const offsetX = (index % 9) - 4;
    const offsetY = Math.floor(index / 9) - 3;
    const tileX = Math.floor(centerWorld.x / TILE_SIZE) + offsetX;
    const tileY = Math.floor(centerWorld.y / TILE_SIZE) + offsetY;
    return {
      x: tileX,
      y: tileY,
      url: `https://tile.openstreetmap.org/${MAP_ZOOM}/${tileX}/${tileY}.png`,
      left: `calc(50% + ${tileX * TILE_SIZE - centerWorld.x}px)`,
      top: `calc(50% + ${tileY * TILE_SIZE - centerWorld.y}px)`,
    };
  });
  return { centerWorld, tiles };
}

export function NewRestaurantPage() {
  const router = useRouter();
  const { settings, updateSettings } = usePreferencesStore();
  const { language, themeMode } = settings;
  const t = newRestaurantText[language];
  const [languageOpen, setLanguageOpen] = useState(false);
  const [resolvedDark, setResolvedDark] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [mapCenter, setMapCenter] = useState(INITIAL_MAP_CENTER);
  const [locationError, setLocationError] = useState("");
  const dragRef = useRef<{ active: boolean; pointerId: number; startX: number; startY: number; centerWorld: { x: number; y: number }; moved: boolean } | null>(null);
  const { centerWorld, tiles: mapTiles } = useMemo(() => getMapTiles(mapCenter), [mapCenter]);
  const form = useForm<NewRestaurantForm>({
    resolver: zodResolver(newRestaurantSchema),
    defaultValues: {
      name: "",
      type: "",
      address: "",
      phone: "",
      taxId: "",
      taxPercent: 12,
      receiptFooter: "",
      adminName: "",
      adminPhone: "",
      adminPin: "",
    },
  });

  const createRestaurant = useMutation({
    mutationFn: (payload: NewRestaurantForm) => apiClient.post("/superadmin/restaurants", payload),
    onSuccess: () => router.push("/superadmin/restaurants"),
  });

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

  function setAddressFromPoint(point: MapPoint) {
    const currentAddress = form.getValues("address")?.split(" | ")[0]?.trim();
    const baseAddress = currentAddress || "Tanlangan joy";
    form.setValue("address", `${baseAddress} | ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function pickPoint(event: MouseEvent<HTMLDivElement>) {
    if (dragRef.current?.moved) {
      dragRef.current = null;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const worldPoint = worldToLatLng(centerWorld.x + x - rect.width / 2, centerWorld.y + y - rect.height / 2, MAP_ZOOM);
    const point = {
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      lat: worldPoint.lat,
      lng: worldPoint.lng,
    };
    setSelectedPoint(point);
    setAddressFromPoint(point);
  }

  function useCurrentLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError(t.geoUnsupported);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          x: 50,
          y: 50,
        };
        setMapCenter({ lat: point.lat, lng: point.lng });
        setSelectedPoint(point);
        setAddressFromPoint(point);
      },
      () => setLocationError(t.geoDenied),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function startMapDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerWorld,
      moved: false,
    };
  }

  function moveMap(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag?.active || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    const nextCenter = worldToLatLng(drag.centerWorld.x - dx, drag.centerWorld.y - dy, MAP_ZOOM);
    setMapCenter(nextCenter);
  }

  function endMapDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current.active = false;
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-6 text-[var(--color-text)]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#13EC37]/15 text-[#13EC37]">
              <Building2 size={24} />
            </div>
            <h1 className="text-3xl font-black tracking-normal">{t.title}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{t.subtitle}</p>
          </div>
          <div className="relative flex items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 text-sm font-semibold text-[var(--color-text)]"
              onClick={() => setLanguageOpen((open) => !open)}
              type="button"
            >
              <Globe size={16} />
              {language.toUpperCase()}
            </button>
            {languageOpen ? (
              <div className="absolute right-28 top-11 z-50 w-40 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
                {languageOptions.map((option) => (
                  <button
                    className={language === option.value ? "block w-full bg-[#13EC37] px-4 py-3 text-left text-sm font-bold text-[#121417]" : "block w-full px-4 py-3 text-left text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]"}
                    key={option.value}
                    onClick={() => {
                      updateSettings({ language: option.value });
                      setLanguageOpen(false);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text)]"
              onClick={() => {
                updateSettings({ themeMode: resolvedDark ? "light" : "dark" });
                setLanguageOpen(false);
              }}
              type="button"
            >
              {resolvedDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" href="/superadmin/restaurants">
              <ArrowLeft size={16} />
              {t.back}
            </Link>
          </div>
        </div>

        <form className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={form.handleSubmit((values) => createRestaurant.mutate(values))}>
          {createRestaurant.isError ? <p className="text-sm text-rose-600">{t.createError}</p> : null}

          <section className="mb-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#13EC37]/15 text-[#13EC37]">
                <MapPin size={20} />
              </span>
              <div>
                <h2 className="text-lg font-black">{t.details}</h2>
                <p className="text-sm text-[var(--color-muted)]">{t.detailsHint}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label={t.name} error={form.formState.errors.name?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" {...form.register("name")} />
              </FormField>
              <FormField label={t.type} error={form.formState.errors.type?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" {...form.register("type")} />
              </FormField>
              <FormField label={t.phone} error={form.formState.errors.phone?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" {...form.register("phone")} />
              </FormField>
              <div className="md:col-span-3">
                <FormField label={t.address} error={form.formState.errors.address?.message}>
                  <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" placeholder={t.addressPlaceholder} {...form.register("address")} />
                </FormField>
                <div className="mt-2 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
                    <div>
                      <div className="text-sm font-bold text-[var(--color-text)]">{t.mapTitle}</div>
                      <div className="text-xs text-[var(--color-hint)]">{t.mapHint}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={useCurrentLocation} type="button">
                        {t.myLocation}
                      </button>
                      <button
                        className="rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface2)]"
                        onClick={() => {
                          setSelectedPoint(null);
                          form.setValue("address", "", { shouldDirty: true });
                        }}
                        type="button"
                      >
                        {t.clear}
                      </button>
                    </div>
                  </div>
                  <div
                    className="relative h-72 touch-none cursor-grab overflow-hidden bg-[#dbe7d3] active:cursor-grabbing"
                    onClick={pickPoint}
                    onPointerDown={startMapDrag}
                    onPointerMove={moveMap}
                    onPointerUp={endMapDrag}
                    onPointerCancel={endMapDrag}
                    role="button"
                    tabIndex={0}
                  >
                    {mapTiles.map((tile) => (
                      <img
                        alt=""
                        className="absolute h-64 w-64 select-none"
                        draggable={false}
                        key={`${tile.x}-${tile.y}`}
                        src={tile.url}
                        style={{ left: tile.left, top: tile.top }}
                      />
                    ))}
                    <div className="absolute inset-0 bg-black/5" />
                    {selectedPoint ? (
                      <div
                        className="absolute -translate-x-1/2 -translate-y-full text-[#13EC37]"
                        style={{ left: `${selectedPoint.x}%`, top: `${selectedPoint.y}%` }}
                      >
                        <MapPin size={34} fill="#13EC37" className="drop-shadow-[0_8px_18px_rgba(19,236,55,0.45)]" />
                      </div>
                    ) : null}
                    <div className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                      © OpenStreetMap contributors
                    </div>
                  </div>
                  {selectedPoint ? (
                    <div className="border-t border-[var(--color-border)] px-4 py-3 text-xs font-semibold text-[var(--color-muted)]">
                      {t.selectedCoordinate}: {selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}
                    </div>
                  ) : null}
                  {locationError ? (
                    <div className="border-t border-[var(--color-border)] px-4 py-3 text-xs font-semibold text-rose-300">
                      {locationError}
                    </div>
                  ) : null}
                </div>
              </div>
              <FormField label={t.taxId} error={form.formState.errors.taxId?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" {...form.register("taxId")} />
              </FormField>
              <FormField label={t.taxPercent} error={form.formState.errors.taxPercent?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" inputMode="decimal" {...form.register("taxPercent", { valueAsNumber: true })} />
              </FormField>
              <div className="md:col-span-3">
                <FormField label={t.receiptFooter} error={form.formState.errors.receiptFooter?.message}>
                  <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" {...form.register("receiptFooter")} />
                </FormField>
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#13EC37]/15 text-[#13EC37]">
                <Crown size={20} />
              </span>
              <div>
                <h2 className="text-lg font-black">{t.firstAdmin}</h2>
                <p className="text-sm text-[var(--color-muted)]">{t.firstAdminHint}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label={t.adminName} error={form.formState.errors.adminName?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" {...form.register("adminName")} />
              </FormField>
              <FormField label={t.adminPhone} error={form.formState.errors.adminPhone?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" {...form.register("adminPhone")} />
              </FormField>
              <FormField label={t.adminPassword} error={form.formState.errors.adminPin?.message}>
                <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" type="password" {...form.register("adminPin")} />
              </FormField>
            </div>
          </section>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button disabled={createRestaurant.isPending} className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#13EC37] px-5 text-sm font-black text-[#121417] disabled:opacity-60">
              <ShieldCheck size={17} />
              {createRestaurant.isPending ? t.creating : t.create}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-semibold text-[var(--color-text)]">{label}</span>
      {children}
      <span className="min-h-4 text-xs text-rose-300">{error}</span>
    </label>
  );
}
