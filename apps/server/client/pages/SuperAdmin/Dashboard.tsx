"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronRight, Eye, Globe, KeyRound, LayoutDashboard, Moon, Pencil, Power, Settings, ShieldCheck, Store, Sun, Trash2, UserPlus, Users, WalletCards, X } from "lucide-react";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { useAuthStore } from "@/client/store/authStore";
import { Language, usePreferencesStore } from "@/client/store/preferencesStore";

type Stats = { restaurants: number; activeRestaurants: number; orders: number; revenue: number; users: number };
type Restaurant = {
  id: string;
  name: string;
  type?: string | null;
  phone?: string | null;
  isActive: boolean;
  plan: string;
  users: { id: string; name: string }[];
};
type StaffUser = { id: string; name: string; phone?: string | null; role: string; isActive: boolean };
type SuperAdminAccount = { id: string; name: string; email: string; lastLoginAt?: string | null; createdAt: string };
type RestaurantDetail = Omit<Restaurant, "users"> & {
  logo?: string | null;
  address?: string | null;
  taxId?: string | null;
  taxPercent: number;
  currency: string;
  receiptFooter?: string | null;
  planExpiresAt?: string | null;
  users: StaffUser[];
  _count: { tables: number; orders: number };
};
type ApiErrorBody = { error?: string };

const plans = ["FREE", "BASIC", "PRO", "ENTERPRISE"] as const;
const staffRoles = ["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"] as const;
type ActiveView = "dashboard" | "restaurants" | "settings";
const languageOptions: { value: Language; label: string }[] = [
  { value: "uz", label: "O'zbek" },
  { value: "ru", label: "Русский" },
];
const superAdminText = {
  uz: {
    panel: "SuperAdmin panel",
    dashboard: "Dashboard",
    subtitle: "Restoranlar platformasi boshqaruvi",
    overview: "Dashboard umumiy ko‘rinishi",
    overviewHint: "Real vaqtdagi restoranlar, adminlar va biznes ko‘rsatkichlari",
    restaurants: "Restoranlar",
    restaurantFlow: "SuperAdmin → Restoran → Admin / Kassir / Xodimlar",
    addRestaurant: "Yangi restoran qo‘shish",
    addStaff: "Yangi ishchi",
    settings: "Sozlamalar",
    logout: "Chiqish",
    activeRestaurants: "Aktiv restoranlar",
    staff: "Xodimlar",
    revenue: "Daromad",
    chooseRestaurant: "Restoran tanlang",
    chooseRestaurantHint: "Chap menyudagi Restoranlar ro‘yxatidan restoran ustiga bosing.",
    restaurantDetails: "Restoran ma’lumotlari va ishchilari",
    edit: "Tahrirlash",
    deactivate: "Deaktivatsiya",
    activate: "Aktivatsiya",
    loadingStaff: "Xodimlar yuklanmoqda...",
    name: "Ism",
    phone: "Telefon",
    role: "Rol",
    status: "Status",
    actions: "Amallar",
    active: "Aktiv",
    inactive: "Deaktiv",
    notSet: "Kiritilmagan",
    type: "Turi",
    location: "Joylashuvi",
    taxId: "Soliq raqami",
    taxPercent: "QQS",
    receiptFooter: "Chek pastki matni",
    noRestaurant: "Restoran yo‘q",
    assignedAdminMissing: "Tayinlanmagan",
    restaurant: "Restoran",
    staffInfo: "Xodim ma’lumotlari",
    close: "Yopish",
    editStaff: "Xodimni tahrirlash",
    newPassword: "Yangi parol (ixtiyoriy)",
    enabled: "Aktiv",
    save: "Saqlash",
    saving: "Saqlanmoqda...",
    staffUpdateError: "Xodimni yangilashda xato",
    newStaff: "Yangi ishchi",
    staffCreateError: "Ishchi yaratishda xato",
    creating: "Yaratilmoqda...",
    createStaff: "Ishchi yaratish",
    staffPassword: "Parol (kamida 4 belgi)",
    editRestaurant: "Restoran ma’lumotlarini tahrirlash",
    restaurantName: "Restoran nomi",
    taxPercentFull: "QQS foizi",
    restaurantUpdateError: "Restoranni yangilashda xato",
    deleteConfirm: "deaktivatsiya qilinsinmi?",
    profileSettings: "SuperAdmin sozlamalari",
    profileSettingsHint: "Profil, parol va yangi SuperAdminlar",
    profile: "Profil",
    profileDetails: "Profil ma’lumotlari",
    email: "Email",
    currentPassword: "Joriy parol",
    newStrongPassword: "Yangi kuchli parol",
    leaveBlankPassword: "Parolni o‘zgartirmasangiz bo‘sh qoldiring",
    updateProfile: "Profilni yangilash",
    profileUpdateError: "Profilni yangilashda xato",
    superAdmins: "SuperAdminlar",
    addSuperAdmin: "Yangi SuperAdmin qo‘shish",
    addSuperAdminHint: "Yangi admin qo‘shiladi, mavjudlari o‘chirilmaydi yoki tahrirlanmaydi.",
    createdAt: "Yaratilgan",
    lastLogin: "Oxirgi kirish",
    never: "Hali kirmagan",
    viewDetails: "Detail",
    createSuperAdmin: "SuperAdmin yaratish",
    superAdminCreateError: "SuperAdmin yaratishda xato",
    strongPasswordHint: "Kamida 8 belgi: katta/kichik harf, raqam va maxsus belgi.",
  },
  ru: {
    panel: "Панель SuperAdmin",
    dashboard: "Дашборд",
    subtitle: "Управление платформой ресторанов",
    overview: "Общий обзор",
    overviewHint: "Рестораны, администраторы и бизнес-показатели в реальном времени",
    restaurants: "Рестораны",
    restaurantFlow: "SuperAdmin → Ресторан → Админ / Кассир / Сотрудники",
    addRestaurant: "Добавить ресторан",
    addStaff: "Новый сотрудник",
    settings: "Настройки",
    logout: "Выйти",
    activeRestaurants: "Активные рестораны",
    staff: "Сотрудники",
    revenue: "Выручка",
    chooseRestaurant: "Выберите ресторан",
    chooseRestaurantHint: "Нажмите на ресторан в списке слева.",
    restaurantDetails: "Данные ресторана и сотрудники",
    edit: "Редактировать",
    deactivate: "Деактивировать",
    activate: "Активировать",
    loadingStaff: "Загрузка сотрудников...",
    name: "Имя",
    phone: "Телефон",
    role: "Роль",
    status: "Статус",
    actions: "Действия",
    active: "Активен",
    inactive: "Неактивен",
    notSet: "Не указано",
    type: "Тип",
    location: "Расположение",
    taxId: "Налоговый номер",
    taxPercent: "НДС",
    receiptFooter: "Текст внизу чека",
    noRestaurant: "Ресторанов нет",
    assignedAdminMissing: "Не назначен",
    restaurant: "Ресторан",
    staffInfo: "Данные сотрудника",
    close: "Закрыть",
    editStaff: "Редактировать сотрудника",
    newPassword: "Новый пароль (необязательно)",
    enabled: "Активен",
    save: "Сохранить",
    saving: "Сохраняется...",
    staffUpdateError: "Ошибка при обновлении сотрудника",
    newStaff: "Новый сотрудник",
    staffCreateError: "Ошибка при создании сотрудника",
    creating: "Создаётся...",
    createStaff: "Создать сотрудника",
    staffPassword: "Пароль (минимум 4 символа)",
    editRestaurant: "Редактировать данные ресторана",
    restaurantName: "Название ресторана",
    taxPercentFull: "Процент НДС",
    restaurantUpdateError: "Ошибка при обновлении ресторана",
    deleteConfirm: "деактивировать?",
    profileSettings: "Настройки SuperAdmin",
    profileSettingsHint: "Профиль, пароль и новые SuperAdmin",
    profile: "Профиль",
    profileDetails: "Данные профиля",
    email: "Email",
    currentPassword: "Текущий пароль",
    newStrongPassword: "Новый надёжный пароль",
    leaveBlankPassword: "Оставьте пустым, если пароль не меняется",
    updateProfile: "Обновить профиль",
    profileUpdateError: "Ошибка обновления профиля",
    superAdmins: "SuperAdmin",
    addSuperAdmin: "Добавить SuperAdmin",
    addSuperAdminHint: "Можно только добавить нового администратора и смотреть детали.",
    createdAt: "Создан",
    lastLogin: "Последний вход",
    never: "Ещё не входил",
    viewDetails: "Детали",
    createSuperAdmin: "Создать SuperAdmin",
    superAdminCreateError: "Ошибка создания SuperAdmin",
    strongPasswordHint: "Минимум 8 символов: заглавная/строчная буква, цифра и спецсимвол.",
  },
} as const;

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) return (error.response?.data as ApiErrorBody | undefined)?.error || fallback;
  return fallback;
}

export function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const { settings, updateSettings } = usePreferencesStore();
  const { language, themeMode } = settings;
  const t = superAdminText[language];
  const [resolvedDark, setResolvedDark] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [restaurantsOpen, setRestaurantsOpen] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [viewingStaff, setViewingStaff] = useState<StaffUser | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<(typeof staffRoles)[number]>("WAITER");
  const [editPin, setEditPin] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<(typeof staffRoles)[number]>("WAITER");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [editingRestaurant, setEditingRestaurant] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantType, setRestaurantType] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [restaurantTaxId, setRestaurantTaxId] = useState("");
  const [restaurantTaxPercent, setRestaurantTaxPercent] = useState("");
  const [restaurantReceiptFooter, setRestaurantReceiptFooter] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileCurrentPassword, setProfileCurrentPassword] = useState("");
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [viewingAdmin, setViewingAdmin] = useState<SuperAdminAccount | null>(null);
  const stats = useQuery({ queryKey: ["superadmin-stats"], queryFn: () => getData<Stats>("/superadmin/stats") });
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: () => getData<Paginated<Restaurant>>("/superadmin/restaurants?limit=50") });
  const profile = useQuery({ queryKey: ["superadmin-profile"], queryFn: () => getData<SuperAdminAccount>("/superadmin/profile") });
  const superAdmins = useQuery({ queryKey: ["superadmin-admins"], queryFn: () => getData<SuperAdminAccount[]>("/superadmin/admins") });
  const selectedRestaurant = useQuery({
    queryKey: ["superadmin-restaurant", selectedRestaurantId],
    enabled: Boolean(selectedRestaurantId),
    queryFn: () => getData<RestaurantDetail>(`/superadmin/restaurants/${selectedRestaurantId}`),
  });
  const restaurantDetails = selectedRestaurant.data
    ? [
        { label: t.location, value: selectedRestaurant.data.address || t.notSet },
        { label: t.type, value: selectedRestaurant.data.type || t.restaurant },
        { label: t.phone, value: selectedRestaurant.data.phone || t.notSet },
        { label: t.taxId, value: selectedRestaurant.data.taxId || t.notSet },
        { label: t.taxPercent, value: `${selectedRestaurant.data.taxPercent}%` },
        { label: t.receiptFooter, value: selectedRestaurant.data.receiptFooter || t.notSet },
      ]
    : [];
  const changeStatus = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) => apiClient.put(`/superadmin/restaurants/${payload.id}/status`, { isActive: payload.isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      await queryClient.invalidateQueries({ queryKey: ["superadmin-restaurant", selectedRestaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
  });
  const changePlan = useMutation({
    mutationFn: (payload: { id: string; plan: string }) => apiClient.put(`/superadmin/restaurants/${payload.id}/plan`, { plan: payload.plan }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
  });
  const updateStaff = useMutation({
    mutationFn: (payload: { userId: string; name: string; phone: string; role: string; newPin?: string; isActive: boolean }) =>
      apiClient.put(`/superadmin/restaurants/${selectedRestaurantId}/staff/${payload.userId}`, {
        name: payload.name,
        phone: payload.phone,
        role: payload.role,
        isActive: payload.isActive,
        ...(payload.newPin ? { newPin: payload.newPin } : {}),
      }),
    onSuccess: async () => {
      setEditingStaff(null);
      setEditPin("");
      await queryClient.invalidateQueries({ queryKey: ["superadmin-restaurant", selectedRestaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
  });
  const deleteStaff = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/superadmin/restaurants/${selectedRestaurantId}/staff/${userId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["superadmin-restaurant", selectedRestaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
  });
  const createStaff = useMutation({
    mutationFn: () =>
      apiClient.post(`/superadmin/restaurants/${selectedRestaurantId}/staff`, {
        name: newStaffName,
        phone: newStaffPhone,
        role: newStaffRole,
        pin: newStaffPin,
      }),
    onSuccess: async () => {
      setCreatingStaff(false);
      setNewStaffName("");
      setNewStaffPhone("");
      setNewStaffRole("WAITER");
      setNewStaffPin("");
      await queryClient.invalidateQueries({ queryKey: ["superadmin-restaurant", selectedRestaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
  });
  const updateRestaurant = useMutation({
    mutationFn: () =>
      apiClient.put(`/superadmin/restaurants/${selectedRestaurantId}`, {
        name: restaurantName,
        type: restaurantType,
        address: restaurantAddress,
        phone: restaurantPhone,
        taxId: restaurantTaxId,
        taxPercent: Number(restaurantTaxPercent || 0),
        receiptFooter: restaurantReceiptFooter,
      }),
    onSuccess: async () => {
      setEditingRestaurant(false);
      await queryClient.invalidateQueries({ queryKey: ["superadmin-restaurant", selectedRestaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });
  const updateProfile = useMutation({
    mutationFn: () =>
      apiClient.put("/superadmin/profile", {
        name: profileName,
        email: profileEmail,
        ...(profileNewPassword ? { currentPassword: profileCurrentPassword, newPassword: profileNewPassword } : {}),
      }),
    onSuccess: async () => {
      setEditingProfile(false);
      setProfileCurrentPassword("");
      setProfileNewPassword("");
      await queryClient.invalidateQueries({ queryKey: ["superadmin-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["superadmin-admins"] });
    },
  });
  const createSuperAdmin = useMutation({
    mutationFn: () =>
      apiClient.post("/superadmin/admins", {
        name: newAdminName,
        email: newAdminEmail,
        password: newAdminPassword,
      }),
    onSuccess: async () => {
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      await queryClient.invalidateQueries({ queryKey: ["superadmin-admins"] });
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    setProfileName(profile.data.name);
    setProfileEmail(profile.data.email);
  }, [profile.data]);

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

  async function handleLogout() {
    await apiClient.post("/auth/logout").catch(() => undefined);
    logout();
    window.location.href = "/superadmin/login";
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openRestaurant(id: string) {
    setActiveView("restaurants");
    setSelectedRestaurantId(id);
    window.setTimeout(() => scrollToSection("restaurant-workers-section"), 0);
  }

  function startEditStaff(user: StaffUser) {
    setEditingStaff(user);
    setEditName(user.name);
    setEditPhone(user.phone || "");
    setEditRole(user.role as (typeof staffRoles)[number]);
    setEditPin("");
    setEditActive(user.isActive);
  }

  function submitStaffEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStaff) return;
    updateStaff.mutate({
      userId: editingStaff.id,
      name: editName,
      phone: editPhone,
      role: editRole,
      newPin: editPin || undefined,
      isActive: editActive,
    });
  }

  function removeStaff(user: StaffUser) {
    const confirmed = window.confirm(`${user.name} ${t.deleteConfirm}`);
    if (confirmed) deleteStaff.mutate(user.id);
  }

  function submitNewStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRestaurantId) return;
    if (!newStaffName.trim() || newStaffPin.length < 4) return;
    createStaff.mutate();
  }

  function startEditRestaurant() {
    if (!selectedRestaurant.data) return;
    setRestaurantName(selectedRestaurant.data.name);
    setRestaurantType(selectedRestaurant.data.type || "");
    setRestaurantAddress(selectedRestaurant.data.address || "");
    setRestaurantPhone(selectedRestaurant.data.phone || "");
    setRestaurantTaxId(selectedRestaurant.data.taxId || "");
    setRestaurantTaxPercent(String(selectedRestaurant.data.taxPercent));
    setRestaurantReceiptFooter(selectedRestaurant.data.receiptFooter || "");
    setEditingRestaurant(true);
  }

  function submitRestaurantEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRestaurantId) return;
    updateRestaurant.mutate();
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate();
  }

  function startEditProfile() {
    if (!profile.data) return;
    setProfileName(profile.data.name);
    setProfileEmail(profile.data.email);
    setProfileCurrentPassword("");
    setProfileNewPassword("");
    setEditingProfile(true);
  }

  function submitSuperAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createSuperAdmin.mutate();
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="grid min-h-screen lg:grid-cols-[265px_1fr]">
        <aside className="border-r border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="mb-5 rounded-[16px] bg-[var(--color-surface2)] p-4">
            <div className="text-xl font-bold">RestoPOS</div>
            <div className="text-sm text-[var(--color-muted)]">{t.panel}</div>
          </div>

          <nav className="space-y-2">
            <SidebarItem
              active={activeView === "dashboard"}
              icon={<LayoutDashboard size={19} />}
              label={t.dashboard}
              onClick={() => {
                setActiveView("dashboard");
                setSelectedRestaurantId(null);
                window.setTimeout(() => scrollToSection("dashboard-overview"), 0);
              }}
            />
            <div>
              <SidebarItem
                active={activeView === "restaurants"}
                icon={<Store size={19} />}
                label={t.restaurants}
                suffix={<ChevronDown size={17} className={restaurantsOpen ? "rotate-180 transition" : "transition"} />}
                onClick={() => {
                  setActiveView("restaurants");
                  setRestaurantsOpen((open) => !open);
                  window.setTimeout(() => scrollToSection("restaurants-section"), 0);
                }}
              />
              {restaurantsOpen ? (
                <div className="ml-12 mt-2 space-y-1">
                  {restaurants.data?.items.map((restaurant) => (
                    <button
                      key={restaurant.id}
                      className={selectedRestaurantId === restaurant.id ? "block w-full rounded-[10px] bg-[var(--color-surface2)] px-3 py-2 text-left text-sm font-semibold text-[var(--color-text)]" : "block w-full rounded-[10px] px-3 py-2 text-left text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"}
                      onClick={() => openRestaurant(restaurant.id)}
                      type="button"
                    >
                      {restaurant.name}
                    </button>
                  ))}
                  {restaurants.data?.items.length === 0 ? <div className="px-3 py-2 text-sm text-[var(--color-hint)]">{t.noRestaurant}</div> : null}
                  <Link
                    className="block w-full rounded-[10px] bg-[var(--color-surface2)] px-3 py-2 text-left text-sm font-semibold text-[#13EC37] hover:bg-[var(--color-surface2)]"
                    href="/superadmin/restaurants/new"
                  >
                    {t.addRestaurant}
                  </Link>
                </div>
              ) : null}
            </div>
          </nav>

          <div className="mt-8 space-y-2">
            <SidebarItem
              active={activeView === "settings"}
              icon={<Settings size={19} />}
              label={t.settings}
              onClick={() => {
                setActiveView("settings");
                setSelectedRestaurantId(null);
              }}
            />
          </div>

          <button className="mt-2 flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm font-semibold text-rose-300 hover:bg-[var(--color-surface2)]" onClick={handleLogout}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-400/25">
              <Power size={18} />
            </span>
            {t.logout}
          </button>
        </aside>

        <section className="min-w-0">
          <header className="flex h-[72px] items-center justify-between border-b border-[var(--color-border)] px-6">
            <div>
              <h1 className="text-xl font-bold tracking-normal">{t.dashboard}</h1>
              <div className="text-sm text-[var(--color-muted)]">{t.subtitle}</div>
            </div>
            <div className="relative flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 text-sm font-semibold text-[var(--color-text)]"
                onClick={() => setLanguageOpen((open) => !open)}
                type="button"
              >
                <Globe size={16} />
                {language.toUpperCase()}
              </button>
              {languageOpen ? (
                <div className="absolute right-12 top-11 z-50 w-40 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text)]"
                onClick={() => {
                  updateSettings({ themeMode: resolvedDark ? "light" : "dark" });
                  setLanguageOpen(false);
                }}
                type="button"
              >
                {resolvedDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </header>

          <div className="p-6">
            {activeView === "dashboard" ? (
              <>
                <div id="dashboard-overview" className="mb-5 scroll-mt-24">
                  <h2 className="text-2xl font-bold tracking-normal">{t.overview}</h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{t.overviewHint}</p>
                </div>

                <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={<Building2 size={22} />} label={t.restaurants} value={stats.data?.restaurants ?? 0} />
                  <StatCard icon={<ShieldCheck size={22} />} label={t.activeRestaurants} value={stats.data?.activeRestaurants ?? 0} />
                  <StatCard icon={<Users size={22} />} label={t.staff} value={stats.data?.users ?? 0} />
                  <StatCard icon={<WalletCards size={22} />} label={t.revenue} value={`${(stats.data?.revenue ?? 0).toLocaleString("uz-UZ")} UZS`} />
                </div>
              </>
            ) : null}

            {activeView === "settings" ? (
              <section className="grid gap-4">
                <div>
                  <h2 className="text-2xl font-black tracking-normal text-[var(--color-text)]">{t.profileSettings}</h2>
                  <p className="mt-1 text-sm font-medium text-[var(--color-muted)]">{t.profileSettingsHint}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
                  <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                        <KeyRound size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-[var(--color-text)]">{t.profileDetails}</h3>
                        <p className="text-sm font-medium text-[var(--color-muted)]">{t.profile}</p>
                      </div>
                      <button className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm font-bold text-emerald-400 hover:bg-emerald-400/10" disabled={!profile.data} onClick={startEditProfile} type="button">
                        <Pencil size={16} />
                        {t.edit}
                      </button>
                    </div>
                    <div className="space-y-3">
                      <InfoRow label={t.name} value={profile.data?.name || t.notSet} />
                      <InfoRow label={t.email} value={profile.data?.email || t.notSet} />
                      <InfoRow label={t.createdAt} value={profile.data?.createdAt ? new Date(profile.data.createdAt).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ") : t.notSet} />
                      <InfoRow label={t.lastLogin} value={profile.data?.lastLoginAt ? new Date(profile.data.lastLoginAt).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ") : t.never} />
                    </div>
                  </section>

                  <form className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5" onSubmit={submitSuperAdmin}>
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                        <UserPlus size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[var(--color-text)]">{t.addSuperAdmin}</h3>
                        <p className="text-sm font-medium text-[var(--color-muted)]">{t.addSuperAdminHint}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <DarkInput placeholder={t.name} value={newAdminName} onChange={setNewAdminName} />
                      <DarkInput placeholder={t.email} type="email" value={newAdminEmail} onChange={setNewAdminEmail} />
                      <div className="md:col-span-2">
                        <DarkInput placeholder={t.newStrongPassword} type="password" value={newAdminPassword} onChange={setNewAdminPassword} />
                      </div>
                    </div>
                    <div className="mt-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-muted)]">
                      {t.strongPasswordHint}
                    </div>
                    {createSuperAdmin.error ? <div className="mt-3 rounded-md bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-500">{t.superAdminCreateError}</div> : null}
                    <button className="mt-4 h-11 w-full rounded-[14px] bg-[#13EC37] px-3 text-sm font-black text-[#121417] disabled:opacity-60" disabled={createSuperAdmin.isPending} type="submit">
                      {createSuperAdmin.isPending ? t.creating : t.createSuperAdmin}
                    </button>
                  </form>
                </div>

                <div className="overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="border-b border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-3 text-lg font-black text-[var(--color-text)]">{t.superAdmins}</div>
                  <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_110px] px-4 py-3 text-xs font-black uppercase text-[var(--color-muted)]">
                    <div>{t.name}</div>
                    <div>{t.email}</div>
                    <div>{t.createdAt}</div>
                    <div>{t.lastLogin}</div>
                    <div>{t.actions}</div>
                  </div>
                  {superAdmins.data?.map((admin) => (
                    <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_110px] items-center border-t border-[var(--color-border)] px-4 py-3 text-sm" key={admin.id}>
                      <div className="font-bold text-[var(--color-text)]">{admin.name}</div>
                      <div className="font-medium text-[var(--color-muted)]">{admin.email}</div>
                      <div className="font-medium text-[var(--color-muted)]">{new Date(admin.createdAt).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ")}</div>
                      <div className="font-medium text-[var(--color-muted)]">{admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ") : t.never}</div>
                      <button className="flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => setViewingAdmin(admin)} type="button">
                        <Eye size={16} />
                        {t.viewDetails}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeView !== "settings" ? (
            <div className="grid gap-4">
              <section id="restaurants-section" className="scroll-mt-24">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold">{t.restaurants}</h3>
                    <p className="text-sm text-[var(--color-muted)]">{t.restaurantFlow}</p>
                  </div>
                  <button
                    className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedRestaurantId}
                    onClick={() => setCreatingStaff(true)}
                    type="button"
                  >
                    {t.addStaff}
                  </button>
                </div>

                {activeView === "dashboard" ? (
                  <div className="overflow-hidden rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <div className="grid grid-cols-[1.5fr_1fr_130px_130px_110px_70px] border-b border-[var(--color-border)] bg-[var(--color-surface2)] px-4 py-3 text-xs font-bold uppercase text-[var(--color-muted)]">
                      <div>Nomi</div>
                      <div>Admin</div>
                      <div>Status</div>
                      <div>Plan</div>
                      <div>Holat</div>
                      <div />
                    </div>
                    {restaurants.isLoading ? <div className="p-6 text-sm text-[var(--color-muted)]">Yuklanmoqda...</div> : null}
                    {restaurants.data?.items.map((restaurant) => (
                      <div className="grid grid-cols-[1.5fr_1fr_130px_130px_110px_70px] items-center border-b border-[var(--color-border)] px-4 py-3 last:border-0" key={restaurant.id}>
                        <div className="min-w-0">
                          <button className="block max-w-full truncate text-left font-semibold text-[var(--color-text)] hover:text-emerald-300" onClick={() => openRestaurant(restaurant.id)} type="button">
                            {restaurant.name}
                          </button>
                          <div className="truncate text-sm text-[var(--color-muted)]">{restaurant.type || "Restaurant"}</div>
                        </div>
                        <div className="truncate text-sm text-[var(--color-text)]">{restaurant.users[0]?.name || t.assignedAdminMissing}</div>
                        <div>
                          <span className={restaurant.isActive ? "rounded-md bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300" : "rounded-md bg-rose-400/15 px-2.5 py-1 text-xs font-bold text-rose-300"}>
                            {restaurant.isActive ? t.active : t.inactive}
                          </span>
                        </div>
                        <select className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-text)] outline-none" value={restaurant.plan} onChange={(event) => changePlan.mutate({ id: restaurant.id, plan: event.target.value })}>
                          {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                        </select>
                        <button className="h-9 rounded-md border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => changeStatus.mutate({ id: restaurant.id, isActive: !restaurant.isActive })}>
                          {restaurant.isActive ? t.inactive : t.active}
                        </button>
                        <button className="justify-self-end rounded-md p-2 text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => openRestaurant(restaurant.id)} type="button">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    ))}
                    {restaurants.data?.items.length === 0 ? <div className="p-8 text-center text-sm text-[var(--color-muted)]">{t.noRestaurant}</div> : null}
                  </div>
                ) : null}

                {activeView === "restaurants" && !selectedRestaurantId ? (
                  <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
                    <div className="text-lg font-bold text-[var(--color-text)]">{t.chooseRestaurant}</div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">{t.chooseRestaurantHint}</div>
                  </div>
                ) : null}

                {selectedRestaurantId ? (
                  <div id="restaurant-workers-section" className="mt-4 scroll-mt-24 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold">{selectedRestaurant.data?.name || t.restaurant}</h3>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">{t.restaurantDetails}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="flex h-9 items-center gap-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!selectedRestaurant.data}
                          onClick={startEditRestaurant}
                          type="button"
                        >
                          <Pencil size={16} />
                          {t.edit}
                        </button>
                        <button
                          className={selectedRestaurant.data?.isActive ? "flex h-9 items-center gap-2 rounded-[12px] border border-rose-400/30 bg-rose-400/10 px-3 text-sm font-semibold text-rose-300 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50" : "flex h-9 items-center gap-2 rounded-[12px] border border-emerald-400/30 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"}
                          disabled={!selectedRestaurant.data || changeStatus.isPending}
                          onClick={() => {
                            if (!selectedRestaurant.data) return;
                            changeStatus.mutate({ id: selectedRestaurant.data.id, isActive: !selectedRestaurant.data.isActive });
                          }}
                          type="button"
                        >
                          {selectedRestaurant.data?.isActive ? t.deactivate : t.activate}
                        </button>
                      </div>
                    </div>

                    {selectedRestaurant.isLoading ? <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-sm text-[var(--color-muted)]">{t.loadingStaff}</div> : null}
                    {selectedRestaurant.data ? (
                      <>
                        <div className="mb-4 grid gap-3 md:grid-cols-3">
                          {restaurantDetails.map((detail) => (
                            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4" key={detail.label}>
                              <div className="text-sm text-[var(--color-muted)]">{detail.label}</div>
                              <div className="mt-1 min-h-7 break-words text-lg font-bold text-[var(--color-text)]">{detail.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)]">
                          <div className="grid grid-cols-[1.3fr_1fr_120px_110px_130px] bg-[var(--color-surface2)] px-4 py-3 text-xs font-bold uppercase text-[var(--color-muted)]">
                            <div>{t.name}</div>
                            <div>{t.phone}</div>
                            <div>{t.role}</div>
                            <div>{t.status}</div>
                            <div>{t.actions}</div>
                          </div>
                          {selectedRestaurant.data.users.map((user) => (
                            <div className="grid grid-cols-[1.3fr_1fr_120px_110px_130px] items-center border-t border-[var(--color-border)] px-4 py-3 text-sm" key={user.id}>
                              <div className="truncate font-semibold text-[var(--color-text)]">{user.name}</div>
                              <div className="truncate text-[var(--color-muted)]">{user.phone || "-"}</div>
                              <div>
                                <span className="rounded-md bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">{user.role}</span>
                              </div>
                              <div>
                                <span className={user.isActive ? "rounded-md bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300" : "rounded-md bg-rose-400/15 px-2.5 py-1 text-xs font-bold text-rose-300"}>
                                  {user.isActive ? t.active : t.inactive}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]" onClick={() => setViewingStaff(user)} type="button" aria-label="Ko‘rish">
                                  <Eye size={16} />
                                </button>
                                <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-emerald-300 hover:bg-emerald-400/10" onClick={() => startEditStaff(user)} type="button" aria-label="Tahrirlash">
                                  <Pencil size={16} />
                                </button>
                                <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/30 text-rose-300 hover:bg-rose-400/10" disabled={deleteStaff.isPending} onClick={() => removeStaff(user)} type="button" aria-label="O‘chirish">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {selectedRestaurant.data.users.length === 0 ? <div className="p-6 text-center text-sm text-[var(--color-muted)]">Bu restoranda xodim yo‘q</div> : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </div>
            ) : null}
          </div>
        </section>
      </div>

      {viewingStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">{viewingStaff.name}</h3>
                <p className="text-sm text-[var(--color-muted)]">{t.staffInfo}</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => setViewingStaff(null)} type="button" aria-label={t.close}>
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3">
              <InfoRow label={t.name} value={viewingStaff.name} />
              <InfoRow label={t.phone} value={viewingStaff.phone || "-"} />
              <InfoRow label={t.role} value={viewingStaff.role} />
              <InfoRow label={t.status} value={viewingStaff.isActive ? t.active : t.inactive} />
            </div>
          </div>
        </div>
      ) : null}

      {viewingAdmin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">{viewingAdmin.name}</h3>
                <p className="text-sm font-medium text-[var(--color-muted)]">{t.superAdmins}</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => setViewingAdmin(null)} type="button" aria-label={t.close}>
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3">
              <InfoRow label={t.name} value={viewingAdmin.name} />
              <InfoRow label={t.email} value={viewingAdmin.email} />
              <InfoRow label={t.createdAt} value={new Date(viewingAdmin.createdAt).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ")} />
              <InfoRow label={t.lastLogin} value={viewingAdmin.lastLoginAt ? new Date(viewingAdmin.lastLoginAt).toLocaleString(language === "ru" ? "ru-RU" : "uz-UZ") : t.never} />
            </div>
          </div>
        </div>
      ) : null}

      {editingProfile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={submitProfile}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">{t.updateProfile}</h3>
                <p className="text-sm font-medium text-[var(--color-muted)]">{t.leaveBlankPassword}</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => setEditingProfile(false)} type="button" aria-label={t.close}>
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3">
              <DarkInput placeholder={t.name} value={profileName} onChange={setProfileName} />
              <DarkInput placeholder={t.email} type="email" value={profileEmail} onChange={setProfileEmail} />
              <DarkInput placeholder={t.currentPassword} type="password" value={profileCurrentPassword} onChange={setProfileCurrentPassword} />
              <DarkInput placeholder={t.newStrongPassword} type="password" value={profileNewPassword} onChange={setProfileNewPassword} />
              <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-muted)]">
                {t.strongPasswordHint}
              </div>
              {updateProfile.error ? <div className="rounded-md bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-500">{t.profileUpdateError}</div> : null}
              <button className="h-11 w-full rounded-[14px] bg-[#13EC37] px-3 text-sm font-black text-[#121417] disabled:opacity-60" disabled={updateProfile.isPending} type="submit">
                {updateProfile.isPending ? t.saving : t.save}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={submitStaffEdit}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">{t.editStaff}</h3>
                <p className="text-sm text-[var(--color-muted)]">{editingStaff.name}</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => setEditingStaff(null)} type="button" aria-label={t.close}>
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3">
              <DarkInput placeholder={t.name} value={editName} onChange={setEditName} />
              <DarkInput placeholder={t.phone} value={editPhone} onChange={setEditPhone} />
              <select className="h-11 w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" value={editRole} onChange={(event) => setEditRole(event.target.value as (typeof staffRoles)[number])}>
                {staffRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <DarkInput placeholder={t.newPassword} type="password" value={editPin} onChange={setEditPin} />
              <label className="flex items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 text-sm font-semibold text-[var(--color-text)]">
                {t.enabled}
                <input checked={editActive} className="h-4 w-4 accent-[#13EC37]" onChange={(event) => setEditActive(event.target.checked)} type="checkbox" />
              </label>
              {updateStaff.error ? <div className="rounded-md bg-rose-400/10 px-3 py-2 text-sm text-rose-300">{apiErrorMessage(updateStaff.error, t.staffUpdateError)}</div> : null}
              <button className="h-11 w-full rounded-[14px] bg-[#13EC37] px-3 text-sm font-bold text-[#121417] disabled:opacity-60" disabled={updateStaff.isPending} type="submit">
                {updateStaff.isPending ? t.saving : t.save}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {creatingStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={submitNewStaff}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">{t.newStaff}</h3>
                <p className="text-sm text-[var(--color-muted)]">{selectedRestaurant.data?.name || t.restaurant}</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => setCreatingStaff(false)} type="button" aria-label={t.close}>
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3">
              <DarkInput placeholder={t.name} value={newStaffName} onChange={setNewStaffName} />
              <DarkInput placeholder={t.phone} value={newStaffPhone} onChange={setNewStaffPhone} />
              <select className="h-11 w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#13EC37]" value={newStaffRole} onChange={(event) => setNewStaffRole(event.target.value as (typeof staffRoles)[number])}>
                {staffRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <DarkInput placeholder={t.staffPassword} type="password" value={newStaffPin} onChange={setNewStaffPin} />
              {createStaff.error ? <div className="rounded-md bg-rose-400/10 px-3 py-2 text-sm text-rose-300">{apiErrorMessage(createStaff.error, t.staffCreateError)}</div> : null}
              <button className="h-11 w-full rounded-[14px] bg-[#13EC37] px-3 text-sm font-bold text-[#121417] disabled:opacity-60" disabled={createStaff.isPending || !newStaffName.trim() || newStaffPin.length < 4} type="submit">
                {createStaff.isPending ? t.creating : t.createStaff}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingRestaurant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form className="w-full max-w-lg rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={submitRestaurantEdit}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">{t.editRestaurant}</h3>
                <p className="text-sm text-[var(--color-muted)]">{selectedRestaurant.data?.name || t.restaurant}</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={() => setEditingRestaurant(false)} type="button" aria-label={t.close}>
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DarkInput placeholder={t.restaurantName} value={restaurantName} onChange={setRestaurantName} />
              <DarkInput placeholder={t.type} value={restaurantType} onChange={setRestaurantType} />
              <DarkInput placeholder={t.location} value={restaurantAddress} onChange={setRestaurantAddress} />
              <DarkInput placeholder={t.phone} value={restaurantPhone} onChange={setRestaurantPhone} />
              <DarkInput placeholder={t.taxId} value={restaurantTaxId} onChange={setRestaurantTaxId} />
              <DarkInput placeholder={t.taxPercentFull} value={restaurantTaxPercent} onChange={(next) => setRestaurantTaxPercent(next.replace(/[^\d.]/g, ""))} />
              <div className="md:col-span-2">
                <DarkInput placeholder={t.receiptFooter} value={restaurantReceiptFooter} onChange={setRestaurantReceiptFooter} />
              </div>
            </div>
            {updateRestaurant.error ? <div className="mt-3 rounded-md bg-rose-400/10 px-3 py-2 text-sm text-rose-300">{t.restaurantUpdateError}</div> : null}
            <button className="mt-4 h-11 w-full rounded-[14px] bg-[#13EC37] px-3 text-sm font-bold text-[#121417] disabled:opacity-60" disabled={updateRestaurant.isPending} type="submit">
              {updateRestaurant.isPending ? t.saving : t.save}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  suffix,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  suffix?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "flex w-full items-center gap-3 rounded-[14px] bg-[var(--color-surface2)] px-3 py-3 text-left text-sm font-semibold text-[var(--color-text)]" : "flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"}
      onClick={onClick}
    >
      <span className={active ? "flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300" : "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]"}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {suffix}
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface2)] text-emerald-300">{icon}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="text-xs font-bold uppercase text-[var(--color-hint)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function DarkInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      className="h-11 w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-hint)] focus:border-[#13EC37]"
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
