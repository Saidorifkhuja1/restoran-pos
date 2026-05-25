"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  BarChart3,
  Boxes,
  ClipboardList,
  Eye,
  Globe,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Pencil,
  Plus,
  ReceiptText,
  Settings,
  Store,
  Sun,
  Trash2,
  Utensils,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { UserRole } from "@restopos/types";
import { apiClient, getData } from "@/client/api/client";
import { useAuthStore } from "@/client/store/authStore";
import { Language, usePreferencesStore } from "@/client/store/preferencesStore";

type AdminSection = "dashboard" | "staff" | "categories" | "suppliers" | "foods" | "receipts" | "places" | "expenses" | "salary" | "settings";
type Restaurant = { id: string; name: string; type?: string | null; logo?: string | null; address?: string | null; phone?: string | null; taxId?: string | null; taxPercent: number; currency: string; receiptFooter?: string | null };
type Staff = { id: string; name: string; phone?: string | null; role: string; isActive: boolean };
type AdminProfile = Staff & { createdAt?: string; updatedAt?: string };
type Zone = { id: string; name: string; color: string; sortOrder: number; _count?: { tables: number } };
type Table = { id: string; number: number; capacity: number; status: string; zoneId: string; zone: { id: string; name: string } };
type Category = { id: string; name: string; emoji?: string | null; sortOrder: number; _count?: { items: number } };
type MenuItem = { id: string; name: string; price: number; emoji?: string | null; image?: string | null; isAvailable: boolean; category: { id: string; name: string } };
type Supplier = { id: string; name: string; phone?: string | null; contactPerson?: string | null; category?: string | null; balance: number };
type Expense = { id: string; name: string; amount: number; createdAt: string; user?: { name: string } | null; supplier?: { name: string } | null };
type Order = {
  id: string;
  orderNumber: number;
  status: string;
  createdAt: string;
  table: { number: number; zone: { name: string } };
  waiter: { name: string };
  payment?: { totalAmount: number; method: string; paidAt: string } | null;
  items: { price: number; quantity: number }[];
};
type Overview = {
  restaurant: Restaurant | null;
  summary: { revenue: number; orders: number; paidOrders: number; averageCheck: number; expenses: number };
  staff: Staff[];
  zones: Zone[];
  tables: Table[];
  categories: Category[];
  menuItems: MenuItem[];
  suppliers: Supplier[];
  expenses: Expense[];
  orders: Order[];
};

const languageOptions: { value: Language; label: string }[] = [
  { value: "uz", label: "UZ" },
  { value: "ru", label: "RU" },
];

const text = {
  uz: {
    panel: "Restoran admin panel",
    dashboard: "Dashboard",
    staff: "Ishchilar",
    categories: "Taom kategoriyalari",
    suppliers: "Ta'minotchilar",
    foods: "Taomlar",
    receipts: "Cheklar",
    places: "Joylar",
    expenses: "Chiqim",
    settings: "Sozlamalar",
    logout: "Chiqish",
    overview: "Restoran boshqaruvi",
    overviewHint: "Kirim, chiqim, cheklar, joylar va operatsion statistikalar",
    revenue: "Kirim",
    outflow: "Chiqim",
    orders: "Buyurtmalar",
    averageCheck: "O'rtacha chek",
    paid: "To'langan",
    activeStaff: "Aktiv ishchilar",
    availableFood: "Mavjud taomlar",
    occupiedPlaces: "Band joylar",
    restaurantDetails: "Restoran ma'lumotlari",
    name: "Nomi",
    phone: "Telefon",
    role: "Rol",
    status: "Status",
    actions: "Amallar",
    active: "Aktiv",
    inactive: "O'chirilgan",
    available: "Mavjud",
    unavailable: "Mavjud emas",
    empty: "Ma'lumot yo'q",
    add: "Qo'shish",
    create: "Yaratish",
    save: "Saqlash",
    edit: "Tahrirlash",
    close: "Yopish",
    delete: "O'chirish",
    categoryName: "Kategoriya nomi",
    foodName: "Taom nomi",
    price: "Narx",
    supplierName: "Ta'minotchi nomi",
    contactPerson: "Mas'ul shaxs",
    supplierCategory: "Yo'nalish",
    balance: "Balans",
    amount: "Summa",
    expenseName: "Chiqim nomi",
    zone: "Zona",
    place: "Joy",
    hall: "Zal",
    cabins: "Kabinalar",
    tapchans: "Tapchanlar",
    street: "Ko'cha",
    openPlaces: "Joylar ro'yxati",
    table: "Stol",
    cabin: "Kabina",
    tapchan: "Tapchan",
    free: "Bo'sh",
    busy: "Band",
    receipt: "Chek",
    waiter: "Ofitsiant",
    total: "Jami",
    loading: "Yuklanmoqda...",
  },
  ru: {
    panel: "Панель администратора",
    dashboard: "Дашборд",
    staff: "Сотрудники",
    categories: "Категории блюд",
    suppliers: "Поставщики",
    foods: "Блюда",
    receipts: "Чеки",
    places: "Места",
    expenses: "Расход",
    settings: "Настройки",
    logout: "Выйти",
    overview: "Управление рестораном",
    overviewHint: "Приход, расход, чеки, места и операционная статистика",
    revenue: "Приход",
    outflow: "Расход",
    orders: "Заказы",
    averageCheck: "Средний чек",
    paid: "Оплачено",
    activeStaff: "Активные сотрудники",
    availableFood: "Доступные блюда",
    occupiedPlaces: "Занятые места",
    restaurantDetails: "Данные ресторана",
    name: "Название",
    phone: "Телефон",
    role: "Роль",
    status: "Статус",
    actions: "Действия",
    active: "Активен",
    inactive: "Отключен",
    available: "Доступно",
    unavailable: "Недоступно",
    empty: "Нет данных",
    add: "Добавить",
    create: "Создать",
    save: "Сохранить",
    edit: "Редактировать",
    close: "Закрыть",
    delete: "Удалить",
    categoryName: "Название категории",
    foodName: "Название блюда",
    price: "Цена",
    supplierName: "Название поставщика",
    contactPerson: "Контактное лицо",
    supplierCategory: "Направление",
    balance: "Баланс",
    amount: "Сумма",
    expenseName: "Название расхода",
    zone: "Зона",
    place: "Место",
    hall: "Зал",
    cabins: "Кабины",
    tapchans: "Тапчаны",
    street: "Улица",
    openPlaces: "Список мест",
    table: "Стол",
    cabin: "Кабина",
    tapchan: "Тапчан",
    free: "Свободно",
    busy: "Занято",
    receipt: "Чек",
    waiter: "Официант",
    total: "Итого",
    loading: "Загрузка...",
  },
} as const;

type AdminCopy = typeof text.uz;

const placeGroups = [
  { key: "cabins", aliases: ["kabinet", "kabina", "кабин"], icon: Store },
  { key: "hall", aliases: ["zal", "asosiy", "зал"], icon: MapPin },
  { key: "street", aliases: ["ko'cha", "kocha", "street", "tapchan", "tapchang", "tapchanlar", "коча", "улиц", "тапчан"], icon: Boxes },
] as const;

type MapPoint = { lat: number; lng: number; x: number; y: number };
type MapTile = { x: number; y: number; url: string; left: string; top: string };
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

function splitAddressAndPoint(address?: string | null) {
  const raw = address ?? "";
  const match = raw.match(/\|\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return { address: raw, point: null as MapPoint | null };
  return {
    address: raw.slice(0, match.index).trim(),
    point: { lat: Number(match[1]), lng: Number(match[2]), x: 50, y: 50 },
  };
}

function composeAddress(address: string, point: MapPoint | null) {
  const base = address.trim() || "Tanlangan joy";
  return point ? `${base} | ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : base;
}

function classifyZone(name: string) {
  const lower = name.toLowerCase();
  return placeGroups.find((group) => group.aliases.some((alias) => lower.includes(alias)))?.key ?? "hall";
}

function placeLabel(zoneName: string, number: number, t: typeof text.uz) {
  const group = classifyZone(zoneName);
  if (group === "cabins") return `${t.cabin} ${number}`;
  if (group === "street") return `${t.tapchan} ${number}`;
  return `${t.table} ${number}`;
}

function isUnauthorized(error: unknown) {
  return error instanceof AxiosError && error.response?.status === 401;
}

export function AdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const { settings, updateSettings } = usePreferencesStore();
  const { language, themeMode } = settings;
  const t = text[language] as AdminCopy;
  const [resolvedDark, setResolvedDark] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [modal, setModal] = useState<null | "staff" | "category" | "supplier" | "food" | "expense" | "place" | "zone">(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null);
  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null);
  const [viewingFood, setViewingFood] = useState<MenuItem | null>(null);
  const [editingFood, setEditingFood] = useState<MenuItem | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<UserRole>(UserRole.WAITER);
  const [categoryName, setCategoryName] = useState("");
  const [foodName, setFoodName] = useState("");
  const [foodPrice, setFoodPrice] = useState("");
  const [foodCategoryId, setFoodCategoryId] = useState("");
  const [foodImage, setFoodImage] = useState<File | null>(null);
  const [foodImageUrl, setFoodImageUrl] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierCategory, setSupplierCategory] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseSupplierId, setExpenseSupplierId] = useState("");
  const [placeZoneId, setPlaceZoneId] = useState("");
  const [placeNumber, setPlaceNumber] = useState("");
  const [placeCapacity, setPlaceCapacity] = useState("4");
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneColor, setZoneColor] = useState("#3B82F6");

  const deleteStaffMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/staff/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
    onError: (error) => { if (isUnauthorized(error)) router.replace("/login"); },
  });
  const deleteCategoryMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurantId}/menu/categories/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const updateCategoryMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiClient.put(`/restaurants/${restaurantId}/menu/categories/${id}`, { name }),
    onSuccess: async () => {
      setEditingCategoryId(null);
      setCategoryName("");
      setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const deleteSupplierMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/suppliers/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const updateSupplierMut = useMutation({
    mutationFn: (data: { id: string; name: string; phone?: string; contactPerson?: string; category?: string; balance: number }) =>
      apiClient.put(`/admin/suppliers/${data.id}`, { name: data.name, phone: data.phone || null, contactPerson: data.contactPerson || null, category: data.category || null, balance: data.balance }),
    onSuccess: async () => {
      setEditingSupplier(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const updateStaffMut = useMutation({
    mutationFn: (data: { id: string; name: string; phone?: string; role: string; newPin?: string }) =>
      apiClient.put(`/admin/staff/${data.id}`, data),
    onSuccess: async () => {
      setEditingStaff(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const updateFoodMut = useMutation({
    mutationFn: (data: { id: string; name: string; price: number; categoryId: string; isAvailable: boolean; image?: string }) =>
      apiClient.put(`/restaurants/${restaurantId}/menu/items/${data.id}`, { name: data.name, price: data.price, categoryId: data.categoryId, isAvailable: data.isAvailable, ...(data.image ? { image: data.image } : {}) }),
    onSuccess: async () => {
      setEditingFood(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const deleteFoodMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurantId}/menu/items/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const deleteExpenseMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/expenses/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const deletePlaceMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurantId}/tables/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const updateZoneMut = useMutation({
    mutationFn: () => apiClient.put(`/admin/zones/${editingZone?.id}`, { name: zoneName, color: zoneColor }),
    onSuccess: async () => {
      setEditingZone(null);
      setZoneName("");
      setZoneColor("#3B82F6");
      setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      const msg = error instanceof AxiosError ? error.response?.data?.error : undefined;
      setFormError(msg || "Zona yangilashda xato");
    },
  });
  const deleteZoneMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/zones/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
    onError: (error) => {
      const msg = error instanceof AxiosError ? error.response?.data?.error : undefined;
      setFormError(msg || "Zona o'chirishda xato");
    },
  });

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => getData<Overview>("/admin/overview") });
  const data = overview.data;
  const restaurantId = data?.restaurant?.id;

  const sections = [
    { id: "dashboard" as const, label: t.dashboard, icon: LayoutDashboard },
    { id: "staff" as const, label: t.staff, icon: Users },
    { id: "categories" as const, label: t.categories, icon: ClipboardList },
    { id: "suppliers" as const, label: t.suppliers, icon: Boxes },
    { id: "foods" as const, label: t.foods, icon: Utensils },
    { id: "receipts" as const, label: t.receipts, icon: ReceiptText },
    { id: "places" as const, label: t.places, icon: MapPin },
    { id: "expenses" as const, label: t.expenses, icon: WalletCards },
    { id: "salary" as const, label: "Maosh", icon: Banknote },
    { id: "settings" as const, label: t.settings, icon: Settings },
  ];

  const createStaff = useMutation({
    mutationFn: () => apiClient.post("/admin/staff", { name: staffName, phone: staffPhone || undefined, pin: staffPassword, role: staffRole }),
    onSuccess: async () => {
      setStaffName(""); setStaffPhone(""); setStaffPassword(""); setStaffRole(UserRole.WAITER); setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      if (isUnauthorized(error)) router.replace("/admin/login");
    },
  });
  const createCategory = useMutation({
    mutationFn: () => apiClient.post(`/restaurants/${restaurantId}/menu/categories`, { name: categoryName, sortOrder: (data?.categories.length ?? 0) + 1, isActive: true }),
    onSuccess: async () => {
      setCategoryName(""); setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const createFood = useMutation({
    mutationFn: async () => {
      let imageUrl: string | undefined;
      if (foodImage) {
        const form = new FormData();
        form.append("file", foodImage);
        form.append("folder", "menu-items");
        const uploadRes = await apiClient.post<{ data: { url: string } }>("/uploads/cloudinary", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        imageUrl = uploadRes.data.data.url;
      }
      return apiClient.post(`/restaurants/${restaurantId}/menu/items`, {
        categoryId: foodCategoryId,
        name: foodName,
        price: Number(foodPrice),
        image: imageUrl || foodImageUrl || undefined,
        isActive: true,
        isAvailable: true,
      });
    },
    onSuccess: async () => {
      setFoodName(""); setFoodPrice(""); setFoodCategoryId(""); setFoodImage(null); setFoodImageUrl(""); setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => {
      const msg = error instanceof AxiosError ? error.response?.data?.error : undefined;
      setFormError(msg || "Taom yaratishda xato yuz berdi");
    },
  });
  const createSupplier = useMutation({
    mutationFn: () => apiClient.post("/admin/suppliers", { name: supplierName, phone: supplierPhone || undefined, contactPerson: supplierContact || undefined, category: supplierCategory || undefined, balance: 0 }),
    onSuccess: async () => {
      setSupplierName(""); setSupplierPhone(""); setSupplierContact(""); setSupplierCategory(""); setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const createExpense = useMutation({
    mutationFn: () => apiClient.post("/admin/expenses", { name: expenseName, amount: Number(expenseAmount), supplierId: expenseSupplierId || undefined }),
    onSuccess: async () => {
      setExpenseName(""); setExpenseAmount(""); setExpenseSupplierId(""); setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const createPlace = useMutation({
    mutationFn: () => apiClient.post(`/restaurants/${restaurantId}/tables`, { zoneId: placeZoneId, number: Number(placeNumber), capacity: Number(placeCapacity), shape: "RECTANGLE", posX: 0, posY: 0 }),
    onSuccess: async () => {
      setPlaceZoneId(""); setPlaceNumber(""); setPlaceCapacity("4"); setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const createZone = useMutation({
    mutationFn: () => apiClient.post("/admin/zones", { name: zoneName, color: zoneColor }),
    onSuccess: async () => {
      setZoneName(""); setZoneColor("#3B82F6"); setModal(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  function openZoneCreate() {
    setEditingZone(null);
    setZoneName("");
    setZoneColor("#3B82F6");
    setFormError("");
    setModal("zone");
  }

  function openZoneEdit(zone: Zone) {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneColor(zone.color || "#3B82F6");
    setFormError("");
    setModal("zone");
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

  useEffect(() => {
    if (!foodCategoryId && data?.categories[0]) setFoodCategoryId(data.categories[0].id);
    if (!placeZoneId && data?.zones[0]) setPlaceZoneId(data.zones[0].id);
  }, [data?.categories, data?.zones, foodCategoryId, placeZoneId]);

  useEffect(() => {
    if (isUnauthorized(overview.error)) router.replace("/admin/login");
  }, [overview.error, router]);

  async function handleLogout() {
    await apiClient.post("/auth/logout").catch(() => undefined);
    logout();
    window.location.href = "/login";
  }

  const [formError, setFormError] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  function submitModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (modal === "staff") {
      if (!staffName.trim() || !staffPassword.trim()) {
        setFormError("Ism va parol majburiy");
        return;
      }
      createStaff.mutate();
    }
    if (modal === "category") {
      if (!categoryName.trim()) {
        setFormError("Kategoriya nomi majburiy");
        return;
      }
      if (editingCategoryId) {
        updateCategoryMut.mutate({ id: editingCategoryId, name: categoryName });
      } else {
        createCategory.mutate();
      }
    }
    if (modal === "food") {
      if (!foodName.trim() || !foodPrice.trim()) {
        setFormError("Taom nomi va narx majburiy");
        return;
      }
      if (Number(foodPrice) > 2_000_000_000) {
        setFormError("Narx juda katta (maksimum 2,000,000,000)");
        return;
      }
      if (Number(foodPrice) <= 0) {
        setFormError("Narx musbat son bo'lishi kerak");
        return;
      }
      createFood.mutate();
    }
    if (modal === "supplier") {
      if (!supplierName.trim()) {
        setFormError("Ta'minotchi nomi majburiy");
        return;
      }
      createSupplier.mutate();
    }
    if (modal === "expense") {
      if (!expenseName.trim() || !expenseAmount.trim()) {
        setFormError("Chiqim nomi va summa majburiy");
        return;
      }
      createExpense.mutate();
    }
    if (modal === "place") {
      if (!placeNumber.trim()) {
        setFormError("Joy raqami majburiy");
        return;
      }
      if (!placeZoneId) {
        setFormError("Zona tanlang");
        return;
      }
      createPlace.mutate();
    }
    if (modal === "zone") {
      if (!zoneName.trim()) {
        setFormError("Zona nomi majburiy");
        return;
      }
      if (editingZone) updateZoneMut.mutate();
      else createZone.mutate();
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="grid min-h-screen lg:grid-cols-[265px_1fr]">
        <aside className="border-r border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="mb-5 rounded-[16px] bg-[var(--color-surface2)] p-4">
            <div className="text-xl font-black">{data?.restaurant?.name || "RestoPOS"}</div>
            <div className="text-sm font-medium text-[var(--color-muted)]">{t.panel}</div>
          </div>
          <nav className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              if (section.id === "places") {
                return (
                  <div key={section.id}>
                    <SidebarButton active={activeSection === "places"} icon={<Icon size={19} />} label={section.label} onClick={() => setActiveSection("places")} />
                    {activeSection === "places" ? (
                      <div className="ml-12 mt-2 space-y-1">
                        <button className="block w-full rounded-[10px] bg-[#13EC37]/15 px-3 py-2 text-left text-xs font-black text-[#13EC37]" type="button" onClick={() => setModal("place")}>+ Yangi joy</button>
                        {(data?.tables ?? []).map((table) => (
                          <div key={table.id} className="flex items-center justify-between rounded-[10px] bg-[var(--color-surface2)] px-3 py-2">
                            <span className="text-xs font-bold text-[var(--color-text)]">{table.zone.name} · #{table.number}</span>
                            <button className="text-rose-400 hover:text-rose-300" type="button" onClick={() => setConfirmAction(() => () => deletePlaceMut.mutate(table.id))}><Trash2 size={13} /></button>
                          </div>
                        ))}
                        {(data?.tables ?? []).length === 0 ? <div className="px-3 py-2 text-xs font-semibold text-[var(--color-muted)]">Hali joy yo'q</div> : null}
                      </div>
                    ) : null}
                  </div>
                );
              }
              return <SidebarButton key={section.id} active={activeSection === section.id} icon={<Icon size={19} />} label={section.label} onClick={() => setActiveSection(section.id)} />;
            })}
          </nav>
          <button className="mt-8 flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm font-bold text-rose-400 hover:bg-[var(--color-surface2)]" onClick={handleLogout} type="button">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-400/25"><LogOut size={18} /></span>
            {t.logout}
          </button>
        </aside>

        <section className="min-w-0">
          <header className="flex h-[72px] items-center justify-between border-b border-[var(--color-border)] px-6">
            <div>
              <h1 className="text-xl font-black tracking-normal">{t.overview}</h1>
              <div className="text-sm font-medium text-[var(--color-muted)]">{t.overviewHint}</div>
            </div>
            <div className="relative flex items-center gap-2">
              <button className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] px-4 text-sm font-bold text-[var(--color-text)]" onClick={() => setLanguageOpen((open) => !open)} type="button">
                <Globe size={16} /> {language.toUpperCase()}
              </button>
              {languageOpen ? (
                <div className="absolute right-12 top-11 z-50 w-32 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
                  {languageOptions.map((option) => (
                    <button className={language === option.value ? "block w-full bg-[#13EC37] px-4 py-3 text-left text-sm font-black text-[#121417]" : "block w-full px-4 py-3 text-left text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]"} key={option.value} onClick={() => { updateSettings({ language: option.value }); setLanguageOpen(false); }} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text)]" onClick={() => updateSettings({ themeMode: resolvedDark ? "light" : "dark" })} type="button">
                {resolvedDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </header>

          <div className="p-6">
            {overview.isLoading ? <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm font-semibold text-[var(--color-muted)]">{t.loading}</div> : null}

            {activeSection === "dashboard" ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={<Banknote size={22} />} label={t.revenue} value={`${(data?.summary.revenue ?? 0).toLocaleString("uz-UZ")} UZS`} />
                  <StatCard icon={<WalletCards size={22} />} label={t.outflow} value={`${(data?.summary.expenses ?? 0).toLocaleString("uz-UZ")} UZS`} />
                  <StatCard icon={<ReceiptText size={22} />} label={t.orders} value={data?.summary.orders ?? 0} />
                  <StatCard icon={<BarChart3 size={22} />} label={t.averageCheck} value={`${(data?.summary.averageCheck ?? 0).toLocaleString("uz-UZ")} UZS`} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard icon={<Users size={22} />} label={t.activeStaff} value={data?.staff.length ?? 0} />
                  <StatCard icon={<Utensils size={22} />} label={t.availableFood} value={data?.menuItems.filter((item) => item.isAvailable).length ?? 0} />
                  <StatCard icon={<MapPin size={22} />} label={t.occupiedPlaces} value={data?.tables.filter((table) => table.status !== "FREE").length ?? 0} />
                </div>
                <InfoPanel title={t.restaurantDetails} rows={[
                  [t.name, data?.restaurant?.name || "-"],
                  [t.phone, data?.restaurant?.phone || "-"],
                  [t.place, data?.restaurant?.address || "-"],
                  ["QQS", `${data?.restaurant?.taxPercent ?? 12}%`],
                ]} />
              </div>
            ) : null}

            {activeSection === "staff" ? <DataSection title={t.staff} action={() => setModal("staff")} actionLabel={t.add}><StaffTable items={(data?.staff ?? []).filter((item) => item.role !== "ADMIN")} t={t} onDelete={(id) => setConfirmAction(() => () => deleteStaffMut.mutate(id))} onView={(s) => setViewingStaff(s)} onEdit={(s) => setEditingStaff(s)} /></DataSection> : null}
            {activeSection === "categories" ? <DataSection title={t.categories} action={() => { setEditingCategoryId(null); setCategoryName(""); setModal("category"); }} actionLabel={t.add}><CategoryGrid items={data?.categories ?? []} t={t} onDelete={(id) => setConfirmAction(() => () => deleteCategoryMut.mutate(id))} onEdit={(cat) => { setEditingCategoryId(cat.id); setCategoryName(cat.name); setModal("category"); }} onView={(cat) => setViewingCategory(cat)} /></DataSection> : null}
            {activeSection === "suppliers" ? <DataSection title={t.suppliers} action={() => setModal("supplier")} actionLabel={t.add}><SupplierTable items={data?.suppliers ?? []} t={t} onDelete={(id) => setConfirmAction(() => () => deleteSupplierMut.mutate(id))} onView={(s) => setViewingSupplier(s)} onEdit={(s) => setEditingSupplier(s)} /></DataSection> : null}
            {activeSection === "foods" ? <DataSection title={t.foods} action={() => setModal("food")} actionLabel={t.add}><FoodTable items={data?.menuItems ?? []} t={t} onDelete={(id) => setConfirmAction(() => () => deleteFoodMut.mutate(id))} onView={(item) => setViewingFood(item)} onEdit={(item) => setEditingFood(item)} /></DataSection> : null}
            {activeSection === "receipts" ? <ReceiptsSection orders={data?.orders ?? []} t={t} /> : null}
            {activeSection === "expenses" ? <DataSection title={t.expenses} action={() => setModal("expense")} actionLabel={t.add}><ExpenseTable items={data?.expenses ?? []} t={t} onDelete={(id) => setConfirmAction(() => () => deleteExpenseMut.mutate(id))} /></DataSection> : null}
            {activeSection === "places" ? (
              <DataSection title={t.places} action={openZoneCreate} actionLabel="+ Zona">
                {(data?.zones ?? []).length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center">
                    <div className="text-sm font-bold text-[var(--color-muted)]">Hali zona yaratilmagan</div>
                    <button className="mt-3 rounded-[12px] bg-[#13EC37] px-4 py-2 text-sm font-black text-[#121417]" type="button" onClick={openZoneCreate}>+ Zona yaratish</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(data?.zones ?? []).map((zone) => {
                      const zoneTables = (data?.tables ?? []).filter((t) => t.zoneId === zone.id);
                      return (
                        <div key={zone.id}>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: zone.color }} />
                              <span className="text-sm font-black">{zone.name}</span>
                              <span className="text-xs font-semibold text-[var(--color-muted)]">({zoneTables.length} ta)</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" type="button" onClick={() => openZoneEdit(zone)} aria-label="Zonani tahrirlash">
                                <Pencil size={14} />
                              </button>
                              <button className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-rose-400/30 text-rose-300 hover:bg-rose-500/10" type="button" onClick={() => setConfirmAction(() => () => deleteZoneMut.mutate(zone.id))} aria-label="Zonani o'chirish">
                                <Trash2 size={14} />
                              </button>
                              <button className="rounded-[10px] border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" type="button" onClick={() => { setPlaceZoneId(zone.id); setModal("place"); }}>+ Joy</button>
                            </div>
                          </div>
                          {zoneTables.length > 0 ? (
                            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                              {zoneTables.map((table) => {
                                const busy = table.status !== "FREE";
                                return (
                                  <div className={busy ? "rounded-[12px] border border-rose-400/45 bg-rose-500/10 p-3" : "rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"} key={table.id}>
                                    <div className="flex items-center justify-between">
                                      <div className="font-black">{placeLabel(zone.name, table.number, t)}</div>
                                      <div className="flex items-center gap-1">
                                        <Badge tone={busy ? "red" : "green"}>{busy ? t.busy : t.free}</Badge>
                                        <button className="flex h-6 w-6 items-center justify-center rounded-md border border-rose-400/30 text-rose-300" type="button" onClick={() => setConfirmAction(() => () => deletePlaceMut.mutate(table.id))}><Trash2 size={12} /></button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-[12px] border border-dashed border-[var(--color-border)] p-4 text-center text-xs font-semibold text-[var(--color-muted)]">Bu zonada joy yo'q</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DataSection>
            ) : null}
            {activeSection === "settings" ? <SettingsSection restaurant={data?.restaurant ?? null} currentUserId={user?.id} t={t} queryClient={queryClient} /> : null}
            {activeSection === "salary" ? <SalarySection staff={data?.staff ?? []} restaurantId={restaurantId} t={t} /> : null}
          </div>
        </section>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form className="w-full max-w-lg rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={submitModal}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black">{editingCategoryId && modal === "category" ? t.edit : t.create}</h3>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={() => { setModal(null); setEditingCategoryId(null); setEditingZone(null); setFormError(""); }} type="button"><X size={17} /></button>
            </div>
            {formError ? <div className="mb-3 rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-300">{formError}</div> : null}
            <div className="grid gap-3">
              {modal === "staff" ? (
                <>
                  <Input placeholder={t.name} value={staffName} onChange={setStaffName} />
                  <Input placeholder={t.phone} value={staffPhone} onChange={setStaffPhone} />
                  <Input placeholder="Parol" type="password" value={staffPassword} onChange={setStaffPassword} />
                  <SelectField label={t.role} value={staffRole} onChange={(value) => setStaffRole(value as UserRole)}>
                    <option value={UserRole.MANAGER}>MANAGER</option><option value={UserRole.WAITER}>WAITER</option><option value={UserRole.KITCHEN}>KITCHEN</option><option value={UserRole.CASHIER}>CASHIER</option>
                  </SelectField>
                </>
              ) : null}
              {modal === "category" ? <Input placeholder={t.categoryName} value={categoryName} onChange={setCategoryName} /> : null}
              {modal === "food" ? (
                <>
                  <SelectField label={t.categories} value={foodCategoryId} onChange={setFoodCategoryId}>
                    {(data?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </SelectField>
                  <Input placeholder={t.foodName} value={foodName} onChange={setFoodName} />
                  <Input placeholder={t.price} inputMode="numeric" value={foodPrice} onChange={(value) => setFoodPrice(value.replace(/\D/g, ""))} />
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[var(--color-muted)]">Rasm</label>
                    <input
                      className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] file:mr-3 file:rounded-md file:border-0 file:bg-[#13EC37] file:px-3 file:py-1 file:text-xs file:font-black file:text-[#121417]"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFoodImage(e.target.files?.[0] ?? null)}
                    />
                    {foodImage ? <div className="mt-1 text-xs text-emerald-300">{foodImage.name}</div> : null}
                  </div>
                </>
              ) : null}
              {modal === "supplier" ? (
                <>
                  <Input placeholder={t.supplierName} value={supplierName} onChange={setSupplierName} />
                  <Input placeholder={t.phone} value={supplierPhone} onChange={setSupplierPhone} />
                  <Input placeholder={t.contactPerson} value={supplierContact} onChange={setSupplierContact} />
                  <Input placeholder={t.supplierCategory} value={supplierCategory} onChange={setSupplierCategory} />
                </>
              ) : null}
              {modal === "expense" ? (
                <>
                  <Input placeholder="Nima olingan" value={expenseName} onChange={setExpenseName} />
                  <Input placeholder={t.amount} inputMode="numeric" value={expenseAmount} onChange={(value) => setExpenseAmount(value.replace(/\D/g, ""))} />
                  <SelectField label="Ta'minotchi" value={expenseSupplierId} onChange={setExpenseSupplierId}>
                    <option value="">Kimdan olindi (ixtiyoriy)</option>
                    {(data?.suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </SelectField>
                </>
              ) : null}
              {modal === "place" ? (
                <>
                  {(data?.zones ?? []).length === 0 ? (
                    <div className="space-y-3">
                      <div className="rounded-[12px] bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-300">Avval zona yarating</div>
                      <button className="h-11 w-full rounded-[14px] border border-[var(--color-border)] text-sm font-black text-[var(--color-text)]" type="button" onClick={() => setModal("zone")}>+ Zona yaratish</button>
                    </div>
                  ) : (
                    <>
                      <SelectField label={t.zone} value={placeZoneId} onChange={setPlaceZoneId}>
                        {(data?.zones ?? []).map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                      </SelectField>
                      <Input placeholder="Raqam" inputMode="numeric" value={placeNumber} onChange={(value) => setPlaceNumber(value.replace(/\D/g, ""))} />
                      <Input placeholder="Sig'im" inputMode="numeric" value={placeCapacity} onChange={(value) => setPlaceCapacity(value.replace(/\D/g, ""))} />
                    </>
                  )}
                </>
              ) : null}
              {modal === "zone" ? (
                <>
                  <Input placeholder="Zona nomi (masalan: Zal, Kabinalar, Ko'cha)" value={zoneName} onChange={setZoneName} />
                  {!editingZone ? <Input placeholder="Rang (#3B82F6)" value={zoneColor} onChange={setZoneColor} /> : null}
                </>
              ) : null}
            </div>
            <button className="mt-4 h-11 w-full rounded-[14px] bg-[#13EC37] text-sm font-black text-[#121417]" type="submit">{(editingCategoryId && modal === "category") || (editingZone && modal === "zone") ? t.save : t.create}</button>
          </form>
        </div>
      ) : null}

      {viewingCategory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black">{t.categories}</h3>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={() => setViewingCategory(null)} type="button"><X size={17} /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <div className="text-sm font-semibold text-[var(--color-muted)]">{t.name}</div>
                <div className="mt-1 text-lg font-black">{viewingCategory.emoji || "🍽️"} {viewingCategory.name}</div>
              </div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <div className="text-sm font-semibold text-[var(--color-muted)]">{t.foods}</div>
                <div className="mt-1 text-lg font-black">{viewingCategory._count?.items ?? 0} ta</div>
              </div>
            </div>
            <button className="mt-4 h-11 w-full rounded-[14px] border border-[var(--color-border)] text-sm font-black text-[var(--color-text)]" type="button" onClick={() => setViewingCategory(null)}>{t.close}</button>
          </div>
        </div>
      ) : null}

      {viewingStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black">{t.staff}</h3>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={() => setViewingStaff(null)} type="button"><X size={17} /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.name}</div><div className="mt-1 text-lg font-black">{viewingStaff.name}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.phone}</div><div className="mt-1 text-lg font-black">{viewingStaff.phone || "-"}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.role}</div><div className="mt-1 text-lg font-black">{viewingStaff.role}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.status}</div><div className="mt-1"><Badge tone={viewingStaff.isActive ? "green" : "red"}>{viewingStaff.isActive ? t.active : t.inactive}</Badge></div></div>
            </div>
            <button className="mt-4 h-11 w-full rounded-[14px] border border-[var(--color-border)] text-sm font-black text-[var(--color-text)]" type="button" onClick={() => setViewingStaff(null)}>{t.close}</button>
          </div>
        </div>
      ) : null}

      {viewingFood ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black">{t.foods}</h3>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={() => setViewingFood(null)} type="button"><X size={17} /></button>
            </div>
            <div className="space-y-3">
              {viewingFood.image ? <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)]"><img src={viewingFood.image} alt={viewingFood.name} className="h-48 w-full object-cover" /></div> : null}
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.name}</div><div className="mt-1 text-lg font-black">{viewingFood.emoji || "🍽️"} {viewingFood.name}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.categories}</div><div className="mt-1 text-lg font-black">{viewingFood.category.name}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.price}</div><div className="mt-1 text-lg font-black">{viewingFood.price.toLocaleString("uz-UZ")} UZS</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.status}</div><div className="mt-1"><Badge tone={viewingFood.isAvailable ? "green" : "red"}>{viewingFood.isAvailable ? t.available : t.unavailable}</Badge></div></div>
            </div>
            <button className="mt-4 h-11 w-full rounded-[14px] border border-[var(--color-border)] text-sm font-black text-[var(--color-text)]" type="button" onClick={() => setViewingFood(null)}>{t.close}</button>
          </div>
        </div>
      ) : null}

      {viewingSupplier ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black">{t.suppliers}</h3>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={() => setViewingSupplier(null)} type="button"><X size={17} /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.name}</div><div className="mt-1 text-lg font-black">{viewingSupplier.name}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.phone}</div><div className="mt-1 text-lg font-black">{viewingSupplier.phone || "-"}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.contactPerson}</div><div className="mt-1 text-lg font-black">{viewingSupplier.contactPerson || "-"}</div></div>
            </div>
            <button className="mt-4 h-11 w-full rounded-[14px] border border-[var(--color-border)] text-sm font-black text-[var(--color-text)]" type="button" onClick={() => setViewingSupplier(null)}>{t.close}</button>
          </div>
        </div>
      ) : null}

      {editingSupplier ? (
        <SupplierEditModal supplier={editingSupplier} t={t} onClose={() => setEditingSupplier(null)} onSave={(data) => updateSupplierMut.mutate(data)} isPending={updateSupplierMut.isPending} />
      ) : null}

      {editingStaff ? (
        <StaffEditModal staff={editingStaff} t={t} onClose={() => setEditingStaff(null)} onSave={(data) => updateStaffMut.mutate(data)} isPending={updateStaffMut.isPending} />
      ) : null}

      {editingFood ? (
        <FoodEditModal food={editingFood} categories={data?.categories ?? []} t={t} onClose={() => setEditingFood(null)} onSave={(data) => updateFoodMut.mutate(data)} isPending={updateFoodMut.isPending} />
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
            <div className="mb-2 text-center text-3xl">⚠️</div>
            <h3 className="text-center text-lg font-black">O'chirishni tasdiqlang</h3>
            <p className="mt-2 text-center text-sm font-semibold text-[var(--color-muted)]">Rostdan o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="h-11 rounded-[14px] border border-[var(--color-border)] text-sm font-black text-[var(--color-text)]" type="button" onClick={() => setConfirmAction(null)}>Bekor qilish</button>
              <button className="h-11 rounded-[14px] bg-rose-500 text-sm font-black text-white" type="button" onClick={() => { confirmAction(); setConfirmAction(null); }}>O'chirish</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SidebarButton({ icon, label, active, suffix, onClick }: { icon: React.ReactNode; label: string; active?: boolean; suffix?: React.ReactNode; onClick: () => void }) {
  return (
    <button className={active ? "flex w-full items-center gap-3 rounded-[14px] bg-[var(--color-surface2)] px-3 py-3 text-left text-sm font-black text-[var(--color-text)]" : "flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"} onClick={onClick} type="button">
      <span className={active ? "flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300" : "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {suffix}
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <section className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface2)] text-emerald-300">{icon}</div><div className="text-2xl font-black">{value}</div><div className="mt-1 text-sm font-semibold text-[var(--color-muted)]">{label}</div></section>;
}

function DataSection({ title, children, action, actionLabel }: { title: string; children: React.ReactNode; action?: () => void; actionLabel?: string }) {
  return <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black">{title}</h2>{action ? <button className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#13EC37] px-4 text-sm font-black text-[#121417]" onClick={action} type="button"><Plus size={17} />{actionLabel}</button> : null}</div>{children}</section>;
}

function InfoPanel({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="mb-4 text-xl font-black">{title}</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{rows.map(([label, value]) => <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4" key={label}><div className="text-sm font-semibold text-[var(--color-muted)]">{label}</div><div className="mt-1 break-words text-lg font-black">{value}</div></div>)}</div></section>;
}

function StaffTable({ items, t, onDelete, onView, onEdit }: { items: Staff[]; t: typeof text.uz; onDelete: (id: string) => void; onView: (staff: Staff) => void; onEdit: (staff: Staff) => void }) {
  if (!items.length) return <Empty t={t} />;
  return <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)]"><div className="grid grid-cols-[1.3fr_1fr_120px_110px_120px] bg-[var(--color-surface2)] px-4 py-3 text-xs font-black uppercase text-[var(--color-muted)]"><div>{t.name}</div><div>{t.phone}</div><div>{t.role}</div><div>{t.status}</div><div>{t.actions}</div></div>{items.map((item) => <div className="grid grid-cols-[1.3fr_1fr_120px_110px_120px] items-center border-t border-[var(--color-border)] px-4 py-3 text-sm" key={item.id}><div className="font-bold">{item.name}</div><div className="font-semibold text-[var(--color-muted)]">{item.phone || "-"}</div><Badge>{item.role}</Badge><Badge tone={item.isActive ? "green" : "red"}>{item.isActive ? t.active : t.inactive}</Badge><RowActions onView={() => onView(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} /></div>)}</div>;
}

function CategoryGrid({ items, t, onDelete, onEdit, onView }: { items: Category[]; t: typeof text.uz; onDelete: (id: string) => void; onEdit: (cat: Category) => void; onView: (cat: Category) => void }) {
  if (!items.length) return <Empty t={t} />;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map((item) => <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4" key={item.id}><div className="flex items-center justify-between"><div className="text-2xl">{item.emoji || "🍽️"}</div><div className="flex items-center gap-1"><button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text)]" type="button" onClick={() => onView(item)}><Eye size={14} /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] text-emerald-300" type="button" onClick={() => onEdit(item)}><Pencil size={14} /></button><button className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-400/30 text-rose-300" type="button" onClick={() => onDelete(item.id)}><Trash2 size={14} /></button></div></div><div className="mt-3 text-lg font-black">{item.name}</div><div className="text-sm font-semibold text-[var(--color-muted)]">{item._count?.items ?? 0} ta</div></div>)}</div>;
}

function SupplierTable({ items, t, onDelete, onView, onEdit }: { items: Supplier[]; t: typeof text.uz; onDelete: (id: string) => void; onView: (item: Supplier) => void; onEdit: (item: Supplier) => void }) {
  if (!items.length) return <Empty t={t} />;
  return <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)]"><div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_120px] bg-[var(--color-surface2)] px-4 py-3 text-xs font-black uppercase text-[var(--color-muted)]"><div>{t.name}</div><div>{t.phone}</div><div>{t.contactPerson}</div><div>{t.supplierCategory}</div><div>{t.actions}</div></div>{items.map((item) => <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_120px] items-center border-t border-[var(--color-border)] px-4 py-3 text-sm" key={item.id}><div className="font-bold">{item.name}</div><div className="font-semibold text-[var(--color-muted)]">{item.phone || "-"}</div><div className="font-semibold text-[var(--color-muted)]">{item.contactPerson || "-"}</div><div className="font-semibold text-[var(--color-muted)]">{item.category || "-"}</div><RowActions onView={() => onView(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} /></div>)}</div>;
}

function FoodTable({ items, t, onDelete, onView, onEdit }: { items: MenuItem[]; t: typeof text.uz; onDelete: (id: string) => void; onView: (item: MenuItem) => void; onEdit: (item: MenuItem) => void }) {
  if (!items.length) return <Empty t={t} />;
  return <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)]"><div className="grid grid-cols-[1.3fr_1fr_1fr_110px_120px] bg-[var(--color-surface2)] px-4 py-3 text-xs font-black uppercase text-[var(--color-muted)]"><div>{t.name}</div><div>{t.categories}</div><div>{t.price}</div><div>{t.status}</div><div>{t.actions}</div></div>{items.map((item) => <div className="grid grid-cols-[1.3fr_1fr_1fr_110px_120px] items-center border-t border-[var(--color-border)] px-4 py-3 text-sm" key={item.id}><div className="font-bold">{item.emoji || "🍽️"} {item.name}</div><div className="font-semibold text-[var(--color-muted)]">{item.category.name}</div><div className="font-black">{item.price.toLocaleString("uz-UZ")} UZS</div><Badge tone={item.isAvailable ? "green" : "red"}>{item.isAvailable ? t.available : t.unavailable}</Badge><RowActions onView={() => onView(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} /></div>)}</div>;
}

function ReceiptsSection({ orders, t }: { orders: Order[]; t: typeof text.uz }) {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("all");
  const [waiterFilter, setWaiterFilter] = useState("");

  const waiters = useMemo(() => {
    const names = new Set(orders.map((o) => o.waiter.name));
    return Array.from(names).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    const now = new Date();
    let from: Date | null = null;

    if (period === "day") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      from = new Date(now);
      from.setDate(now.getDate() - 7);
    } else if (period === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      from = new Date(now.getFullYear(), 0, 1);
    }

    return orders.filter((order) => {
      if (from && new Date(order.createdAt) < from) return false;
      if (waiterFilter && order.waiter.name !== waiterFilter) return false;
      return true;
    });
  }, [orders, period, waiterFilter]);

  const totalSum = filtered.reduce((sum, o) => sum + (o.payment?.totalAmount ?? o.items.reduce((s, i) => s + i.price * i.quantity, 0)), 0);

  return (
    <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">{t.receipts}</h2>
        <div className="text-lg font-black text-emerald-300">{totalSum.toLocaleString("uz-UZ")} UZS</div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["day", "week", "month", "year", "all"] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={period === p
              ? "rounded-[10px] bg-[#13EC37] px-4 py-2 text-xs font-black text-[#121417]"
              : "rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface2)]"
            }
            onClick={() => setPeriod(p)}
          >
            {p === "day" ? "Bugun" : p === "week" ? "Hafta" : p === "month" ? "Oy" : p === "year" ? "Yil" : "Barchasi"}
          </button>
        ))}
        <label className="grid gap-1">
          <span className="text-[11px] font-black uppercase tracking-wide text-[var(--color-muted)]">Ofitsiant filter</span>
          <select
            className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-bold text-[var(--color-text)] outline-none"
            value={waiterFilter}
            onChange={(e) => setWaiterFilter(e.target.value)}
          >
            <option value="">Barcha ofitsiantlar</option>
            {waiters.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
      </div>
      {filtered.length === 0 ? <Empty t={t} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((order) => {
            const total = order.payment?.totalAmount ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            return (
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4" key={order.id}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black">#{order.orderNumber}</div>
                  <Badge>{order.status}</Badge>
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--color-muted)]">{order.table.zone.name} · {placeLabel(order.table.zone.name, order.table.number, t)}</div>
                <div className="text-sm font-semibold text-[var(--color-muted)]">{t.waiter}: {order.waiter.name}</div>
                <div className="mt-1 text-xs text-[var(--color-muted)]">{new Date(order.createdAt).toLocaleString("uz-UZ")}</div>
                <div className="mt-3 text-xl font-black">{total.toLocaleString("uz-UZ")} UZS</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 text-sm font-semibold text-[var(--color-muted)]">{filtered.length} ta chek</div>
    </section>
  );
}

function ExpenseTable({ items, t, onDelete }: { items: Expense[]; t: typeof text.uz; onDelete: (id: string) => void }) {
  if (!items.length) return <Empty t={t} />;
  return (
    <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[14px] border border-[var(--color-border)]">
      {items.map((item) => (
        <div className="flex items-center justify-between px-4 py-3" key={item.id}>
          <div>
            <div className="font-bold">{item.name}</div>
            <div className="text-xs text-[var(--color-muted)]">
              {new Date(item.createdAt).toLocaleString("uz-UZ")}
              {item.supplier ? ` · ${item.supplier.name}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-black text-rose-400">{item.amount.toLocaleString("uz-UZ")} UZS</div>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-400/30 text-rose-300 hover:bg-rose-400/10" type="button" onClick={() => onDelete(item.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RowActions({ onView, onEdit, onDelete }: { onView?: () => void; onEdit?: () => void; onDelete: () => void }) {
  return <div className="flex items-center gap-2">{onView ? <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" type="button" onClick={onView}><Eye size={16} /></button> : null}{onEdit ? <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-emerald-300 hover:bg-[var(--color-surface2)]" type="button" onClick={onEdit}><Pencil size={16} /></button> : null}<button className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/30 text-rose-300 hover:bg-rose-400/10" type="button" onClick={onDelete}><Trash2 size={16} /></button></div>;
}

function StaffEditModal({ staff, t, onClose, onSave, isPending }: { staff: Staff; t: typeof text.uz; onClose: () => void; onSave: (data: { id: string; name: string; phone?: string; role: string; newPin?: string }) => void; isPending: boolean }) {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone || "");
  const [role, setRole] = useState(staff.role);
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) { setError("Ism majburiy"); return; }
    onSave({ id: staff.id, name, phone: phone || undefined, role, newPin: newPin || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form className="w-full max-w-lg rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">{t.edit}</h3>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={onClose} type="button"><X size={17} /></button>
        </div>
        {error ? <div className="mb-3 rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-300">{error}</div> : null}
        <div className="grid gap-3">
          <Input placeholder={t.name} value={name} onChange={setName} />
          <Input placeholder={t.phone} value={phone} onChange={setPhone} />
          <SelectField label={t.role} value={role} onChange={setRole}>
            <option value="MANAGER">MANAGER</option><option value="WAITER">WAITER</option><option value="KITCHEN">KITCHEN</option><option value="CASHIER">CASHIER</option>
          </SelectField>
          <Input placeholder="Yangi PIN (ixtiyoriy)" value={newPin} onChange={setNewPin} />
        </div>
        <button className="mt-4 h-11 w-full rounded-[14px] bg-[#13EC37] text-sm font-black text-[#121417] disabled:opacity-60" type="submit" disabled={isPending}>{isPending ? "Saqlanmoqda..." : t.save}</button>
      </form>
    </div>
  );
}

function FoodEditModal({ food, categories, t, onClose, onSave, isPending }: { food: MenuItem; categories: Category[]; t: typeof text.uz; onClose: () => void; onSave: (data: { id: string; name: string; price: number; categoryId: string; isAvailable: boolean; image?: string }) => void; isPending: boolean }) {
  const [name, setName] = useState(food.name);
  const [price, setPrice] = useState(String(food.price));
  const [categoryId, setCategoryId] = useState(food.category.id);
  const [isAvailable, setIsAvailable] = useState(food.isAvailable);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !price.trim()) { setError("Nom va narx majburiy"); return; }
    if (Number(price) <= 0 || Number(price) > 2_000_000_000) { setError("Narx noto'g'ri"); return; }

    let imageUrl: string | undefined;
    if (imageFile) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", imageFile);
        form.append("folder", "menu-items");
        const res = await apiClient.post<{ data: { url: string } }>("/uploads/cloudinary", form, { headers: { "Content-Type": "multipart/form-data" } });
        imageUrl = res.data.data.url;
      } catch {
        setError("Rasm yuklashda xato");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSave({ id: food.id, name, price: Number(price), categoryId, isAvailable, image: imageUrl });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form className="w-full max-w-lg rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">{t.edit}</h3>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={onClose} type="button"><X size={17} /></button>
        </div>
        {food.image ? <div className="mb-3 overflow-hidden rounded-[12px] border border-[var(--color-border)]"><img src={food.image} alt={food.name} className="h-32 w-full object-cover" /></div> : null}
        {error ? <div className="mb-3 rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-300">{error}</div> : null}
        <div className="grid gap-3">
          <SelectField label={t.categories} value={categoryId} onChange={setCategoryId}>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </SelectField>
          <Input placeholder={t.foodName} value={name} onChange={setName} />
          <Input placeholder={t.price} inputMode="numeric" value={price} onChange={(v) => setPrice(v.replace(/\D/g, ""))} />
          <label className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="h-5 w-5 rounded" />
            <span className="text-sm font-semibold text-[var(--color-text)]">{t.available}</span>
          </label>
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--color-muted)]">Yangi rasm</label>
            <input className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] file:mr-3 file:rounded-md file:border-0 file:bg-[#13EC37] file:px-3 file:py-1 file:text-xs file:font-black file:text-[#121417]" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <button className="mt-4 h-11 w-full rounded-[14px] bg-[#13EC37] text-sm font-black text-[#121417] disabled:opacity-60" type="submit" disabled={isPending || uploading}>{uploading ? "Rasm yuklanmoqda..." : isPending ? "Saqlanmoqda..." : t.save}</button>
      </form>
    </div>
  );
}

function SettingsSection({ restaurant, currentUserId, t, queryClient }: { restaurant: Restaurant | null; currentUserId?: string; t: typeof text.uz; queryClient: ReturnType<typeof useQueryClient> }) {
  const [editingRestaurant, setEditingRestaurant] = useState(false);
  const initialAddress = splitAddressAndPoint(restaurant?.address);
  const [rName, setRName] = useState(restaurant?.name || "");
  const [rType, setRType] = useState(restaurant?.type || "");
  const [rPhone, setRPhone] = useState(restaurant?.phone || "");
  const [rAddress, setRAddress] = useState(initialAddress.address);
  const [rPoint, setRPoint] = useState<MapPoint | null>(initialAddress.point);
  const [rTaxId, setRTaxId] = useState(restaurant?.taxId || "");
  const [rTaxPercent, setRTaxPercent] = useState(String(restaurant?.taxPercent ?? 12));
  const [rReceiptFooter, setRReceiptFooter] = useState(restaurant?.receiptFooter || "");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");

  const profile = useQuery({
    queryKey: ["admin-profile", currentUserId],
    enabled: Boolean(currentUserId),
    queryFn: () => getData<AdminProfile>("/admin/profile"),
  });

  useEffect(() => {
    if (!restaurant) return;
    const parsed = splitAddressAndPoint(restaurant.address);
    setRName(restaurant.name || "");
    setRType(restaurant.type || "");
    setRPhone(restaurant.phone || "");
    setRAddress(parsed.address);
    setRPoint(parsed.point);
    setRTaxId(restaurant.taxId || "");
    setRTaxPercent(String(restaurant.taxPercent ?? 12));
    setRReceiptFooter(restaurant.receiptFooter || "");
  }, [restaurant]);

  useEffect(() => {
    if (!profile.data) return;
    setProfileName(profile.data.name);
    setProfilePhone(profile.data.phone || "");
  }, [profile.data]);

  const updateRestaurant = useMutation({
    mutationFn: () => apiClient.put("/admin/restaurant", {
      name: rName,
      type: rType || null,
      phone: rPhone || null,
      address: composeAddress(rAddress, rPoint),
      taxId: rTaxId || null,
      taxPercent: Number(rTaxPercent),
      receiptFooter: rReceiptFooter || null,
    }),
    onSuccess: async () => {
      setEditingRestaurant(false);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) => { setError(err instanceof AxiosError ? err.response?.data?.error || "Restoran yangilashda xato" : "Restoran yangilashda xato"); },
  });

  const updateProfile = useMutation({
    mutationFn: () => apiClient.put("/admin/profile", {
      name: profileName,
      phone: profilePhone || null,
      ...(newPassword ? { currentPassword, newPassword } : {}),
    }),
    onSuccess: async () => {
      setEditingProfile(false);
      setProfileError("");
      setCurrentPassword("");
      setNewPassword("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
    },
    onError: (err) => { setProfileError(err instanceof AxiosError ? err.response?.data?.error || "Profil yangilashda xato" : "Profil yangilashda xato"); },
  });

  function submitRestaurantUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!rName.trim()) {
      setError("Restoran nomi majburiy");
      return;
    }
    const tax = Number(rTaxPercent);
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      setError("QQS foizi 0 dan 100 gacha bo'lishi kerak");
      return;
    }
    updateRestaurant.mutate();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Mening profilim</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--color-muted)]">Admin faqat o'z profilini yangilaydi</p>
          </div>
          <button className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" type="button" onClick={() => setEditingProfile(!editingProfile)}>{editingProfile ? "Bekor" : t.edit}</button>
        </div>
        {editingProfile ? (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); setProfileError(""); if (!profileName.trim()) { setProfileError("Ism majburiy"); return; } updateProfile.mutate(); }}>
            {profileError ? <div className="rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-300">{profileError}</div> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder={t.name} value={profileName} onChange={setProfileName} />
              <Input placeholder={t.phone} value={profilePhone} onChange={setProfilePhone} />
              <Input placeholder="Joriy parol" type="password" value={currentPassword} onChange={setCurrentPassword} />
              <Input placeholder="Yangi kuchli parol" type="password" value={newPassword} onChange={setNewPassword} />
            </div>
            <div className="rounded-[12px] bg-[var(--color-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-muted)]">Parolni o'zgartirmasangiz bo'sh qoldiring. Yangi parol kamida 8 belgi, katta/kichik harf, raqam va maxsus belgidan iborat bo'lishi kerak.</div>
            <button className="h-11 rounded-[14px] bg-[#13EC37] text-sm font-black text-[#121417] disabled:opacity-60" type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? "Saqlanmoqda..." : t.save}</button>
          </form>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.name}</div><div className="mt-1 text-lg font-black">{profile.data?.name || "-"}</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.phone}</div><div className="mt-1 text-lg font-black">{profile.data?.phone || "-"}</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.role}</div><div className="mt-1 text-lg font-black">{profile.data?.role || "ADMIN"}</div></div>
          </div>
        )}
      </section>

      <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">{t.restaurantDetails}</h2>
          <button className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" type="button" onClick={() => setEditingRestaurant(!editingRestaurant)}>{editingRestaurant ? "Bekor" : t.edit}</button>
        </div>
        {editingRestaurant ? (
          <form className="grid gap-3" onSubmit={submitRestaurantUpdate}>
            {error ? <div className="rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-300">{error}</div> : null}
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder={t.name} value={rName} onChange={setRName} />
              <Input placeholder="Turi" value={rType} onChange={setRType} />
              <Input placeholder={t.phone} value={rPhone} onChange={setRPhone} />
              <Input placeholder="Soliq raqami" value={rTaxId} onChange={setRTaxId} />
              <Input placeholder="QQS foizi" inputMode="numeric" value={rTaxPercent} onChange={(value) => {
                const next = value.replace(/[^\d.]/g, "");
                const parsed = Number(next);
                setRTaxPercent(next && Number.isFinite(parsed) && parsed > 100 ? "100" : next);
              }} />
              <Input placeholder="Chek pastki matni" value={rReceiptFooter} onChange={setRReceiptFooter} />
            </div>
            <Input placeholder="Manzil" value={rAddress} onChange={setRAddress} />
            <RestaurantMap point={rPoint} address={rAddress} onAddressChange={setRAddress} onPointChange={setRPoint} />
            <button className="h-11 rounded-[14px] bg-[#13EC37] text-sm font-black text-[#121417] disabled:opacity-60" type="submit" disabled={updateRestaurant.isPending}>{t.save}</button>
          </form>
        ) : (
          <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.name}</div><div className="mt-1 text-lg font-black">{restaurant?.name || "-"}</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Turi</div><div className="mt-1 text-lg font-black">{restaurant?.type || "-"}</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">{t.phone}</div><div className="mt-1 text-lg font-black">{restaurant?.phone || "-"}</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Manzil</div><div className="mt-1 text-lg font-black">{restaurant?.address || "-"}</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Soliq raqami</div><div className="mt-1 text-lg font-black">{restaurant?.taxId || "-"}</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">QQS</div><div className="mt-1 text-lg font-black">{restaurant?.taxPercent ?? 12}%</div></div>
            <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Chek pastki matni</div><div className="mt-1 text-lg font-black">{restaurant?.receiptFooter || "-"}</div></div>
          </div>
          <RestaurantMap point={splitAddressAndPoint(restaurant?.address).point} address={splitAddressAndPoint(restaurant?.address).address} readonly />
          </div>
        )}
      </section>
    </div>
  );
}

function RestaurantMap({ point, address, readonly = false, onPointChange, onAddressChange }: { point: MapPoint | null; address: string; readonly?: boolean; onPointChange?: (point: MapPoint | null) => void; onAddressChange?: (address: string) => void }) {
  const [mapCenter, setMapCenter] = useState(point ? { lat: point.lat, lng: point.lng } : INITIAL_MAP_CENTER);
  const [locationError, setLocationError] = useState("");
  const dragRef = useRef<{ active: boolean; pointerId: number; startX: number; startY: number; centerWorld: { x: number; y: number }; moved: boolean } | null>(null);
  const { centerWorld, tiles } = useMemo(() => getMapTiles(mapCenter), [mapCenter]);
  const markerPosition = useMemo(() => {
    if (!point) return null;
    const markerWorld = latLngToWorld(point.lat, point.lng, MAP_ZOOM);
    return {
      left: `calc(50% + ${markerWorld.x - centerWorld.x}px)`,
      top: `calc(50% + ${markerWorld.y - centerWorld.y}px)`,
    };
  }, [centerWorld.x, centerWorld.y, point]);

  useEffect(() => {
    if (point) setMapCenter({ lat: point.lat, lng: point.lng });
  }, [point]);

  function setAddressFromPoint(nextPoint: MapPoint) {
    onAddressChange?.(address || "Tanlangan joy");
    onPointChange?.(nextPoint);
  }

  function pickPoint(event: MouseEvent<HTMLDivElement>) {
    if (readonly) return;
    if (dragRef.current?.moved) {
      dragRef.current = null;
      return;
    }
    dragRef.current = null;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const worldPoint = worldToLatLng(centerWorld.x + x - rect.width / 2, centerWorld.y + y - rect.height / 2, MAP_ZOOM);
    setAddressFromPoint({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      lat: worldPoint.lat,
      lng: worldPoint.lng,
    });
  }

  function useCurrentLocation() {
    if (readonly) return;
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Brauzer joylashuvni qo'llab-quvvatlamaydi");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPoint = { lat: position.coords.latitude, lng: position.coords.longitude, x: 50, y: 50 };
        setMapCenter({ lat: nextPoint.lat, lng: nextPoint.lng });
        setAddressFromPoint(nextPoint);
      },
      () => setLocationError("Joylashuv ruxsati berilmadi yoki aniqlanmadi"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function startMapDrag(event: PointerEvent<HTMLDivElement>) {
    if (readonly) return;
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
    if (readonly || !drag?.active || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    setMapCenter(worldToLatLng(drag.centerWorld.x - dx, drag.centerWorld.y - dy, MAP_ZOOM));
  }

  function endMapDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      const moved = dragRef.current.moved;
      dragRef.current.active = false;
      if (moved) {
        window.setTimeout(() => {
          if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
        }, 0);
      }
    }
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <div className="text-sm font-bold text-[var(--color-text)]">Xaritadan joylashuv</div>
          <div className="text-xs font-semibold text-[var(--color-muted)]">{readonly ? "Restoran joylashuvi" : "Nuqtani bosing yoki xaritani suring"}</div>
        </div>
        {!readonly ? (
          <div className="flex items-center gap-2">
            <button className="rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text)] hover:bg-[var(--color-surface2)]" onClick={useCurrentLocation} type="button">Mening joylashuvim</button>
            <button className="rounded-[10px] border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface2)]" onClick={() => onPointChange?.(null)} type="button">Tozalash</button>
          </div>
        ) : null}
      </div>
      <div
        className={readonly ? "relative h-72 overflow-hidden bg-[#dbe7d3]" : "relative h-72 touch-none cursor-grab overflow-hidden bg-[#dbe7d3] active:cursor-grabbing"}
        onClick={pickPoint}
        onPointerDown={startMapDrag}
        onPointerMove={moveMap}
        onPointerUp={endMapDrag}
        onPointerCancel={endMapDrag}
        role="button"
        tabIndex={readonly ? -1 : 0}
      >
        {tiles.map((tile) => (
          <img alt="" className="absolute h-64 w-64 select-none" draggable={false} key={`${tile.x}-${tile.y}`} src={tile.url} style={{ left: tile.left, top: tile.top }} />
        ))}
        <div className="absolute inset-0 bg-black/5" />
        {point && markerPosition ? (
          <div className="absolute -translate-x-1/2 -translate-y-full text-[#13EC37]" style={markerPosition}>
            <MapPin size={34} fill="#13EC37" className="drop-shadow-[0_8px_18px_rgba(19,236,55,0.45)]" />
          </div>
        ) : null}
        <div className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">© OpenStreetMap contributors</div>
      </div>
      {point ? <div className="border-t border-[var(--color-border)] px-4 py-3 text-xs font-semibold text-[var(--color-muted)]">Tanlangan koordinata: {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</div> : null}
      {locationError ? <div className="border-t border-[var(--color-border)] px-4 py-3 text-xs font-semibold text-rose-300">{locationError}</div> : null}
    </div>
  );
}

type Salary = { id: string; userId: string; userName: string; amount: number; note?: string; createdAt: string };

function SalarySection({ staff, restaurantId }: { staff: Staff[]; restaurantId: string | undefined; t: typeof text.uz }) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"week" | "month" | "year" | "all">("month");
  const [staffFilter, setStaffFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const [viewingSalary, setViewingSalary] = useState<Salary | null>(null);

  const salaries = useQuery({
    queryKey: ["salaries", restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: () => getData<{ items: Salary[] }>(`/admin/salaries?limit=200`),
  });

  const createSalary = useMutation({
    mutationFn: () => apiClient.post("/admin/salaries", { userId, amount: Number(amount), note: note || undefined }),
    onSuccess: async () => {
      setUserId(""); setAmount(""); setNote(""); setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["salaries"] });
    },
    onError: (err) => { setError(err instanceof AxiosError ? err.response?.data?.error || "Xato" : "Xato"); },
  });

  const filtered = useMemo(() => {
    const items = salaries.data?.items ?? [];
    const now = new Date();
    let from: Date | null = null;
    if (period === "week") { from = new Date(now); from.setDate(now.getDate() - 7); }
    else if (period === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (period === "year") { from = new Date(now.getFullYear(), 0, 1); }

    return items.filter((s) => {
      if (from && new Date(s.createdAt) < from) return false;
      if (staffFilter && s.userId !== staffFilter) return false;
      return true;
    });
  }, [salaries.data?.items, period, staffFilter]);

  const totalAmount = filtered.reduce((sum, s) => sum + s.amount, 0);

  return (
    <section className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">Maosh</h2>
        <div className="flex items-center gap-3">
          <div className="text-lg font-black text-emerald-300">{totalAmount.toLocaleString("uz-UZ")} UZS</div>
          <button className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#13EC37] px-4 text-sm font-black text-[#121417]" type="button" onClick={() => setShowForm(!showForm)}><Plus size={17} />Maosh berish</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["week", "month", "year", "all"] as const).map((p) => (
          <button key={p} type="button" className={period === p ? "rounded-[10px] bg-[#13EC37] px-4 py-2 text-xs font-black text-[#121417]" : "rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface2)]"} onClick={() => setPeriod(p)}>
            {p === "week" ? "Hafta" : p === "month" ? "Oy" : p === "year" ? "Yil" : "Barchasi"}
          </button>
        ))}
        <label className="grid gap-1">
          <span className="text-[11px] font-black uppercase tracking-wide text-[var(--color-muted)]">Xodim filter</span>
          <select className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-bold text-[var(--color-text)] outline-none" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">Barcha xodimlar</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
          </select>
        </label>
      </div>

      {showForm ? (
        <form className="mb-4 grid gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4" onSubmit={(e) => { e.preventDefault(); if (!userId || !amount.trim()) { setError("Xodim va summa majburiy"); return; } setError(""); createSalary.mutate(); }}>
          {error ? <div className="rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-300">{error}</div> : null}
          <SelectField label="Xodim" value={userId} onChange={setUserId}>
            <option value="">Xodimni tanlang</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
          </SelectField>
          <Input placeholder="Summa" inputMode="numeric" value={amount} onChange={(v) => setAmount(v.replace(/\D/g, ""))} />
          <Input placeholder="Izoh (ixtiyoriy)" value={note} onChange={setNote} />
          <button className="h-11 rounded-[14px] bg-[#13EC37] text-sm font-black text-[#121417] disabled:opacity-60" type="submit" disabled={createSalary.isPending}>{createSalary.isPending ? "Saqlanmoqda..." : "Maosh berish"}</button>
        </form>
      ) : null}

      {filtered.length === 0 ? <div className="rounded-[14px] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center text-sm font-bold text-[var(--color-muted)]">Maosh to'lovlari yo'q</div> : (
        <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[14px] border border-[var(--color-border)]">
          {filtered.map((salary) => (
            <div className="flex items-center justify-between px-4 py-3" key={salary.id}>
              <div>
                <div className="font-bold text-[var(--color-text)]">{salary.userName}</div>
                <div className="text-xs text-[var(--color-muted)]">{new Date(salary.createdAt).toLocaleString("uz-UZ")}{salary.note ? ` · ${salary.note}` : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-black text-emerald-300">{salary.amount.toLocaleString("uz-UZ")} UZS</div>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface2)]" type="button" onClick={() => setViewingSalary(salary)}><Eye size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 text-sm font-semibold text-[var(--color-muted)]">{filtered.length} ta to'lov</div>

      {viewingSalary ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black">Maosh tafsilotlari</h3>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={() => setViewingSalary(null)} type="button"><X size={17} /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Xodim</div><div className="mt-1 text-lg font-black">{viewingSalary.userName}</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Summa</div><div className="mt-1 text-lg font-black text-emerald-300">{viewingSalary.amount.toLocaleString("uz-UZ")} UZS</div></div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Sana</div><div className="mt-1 text-lg font-black">{new Date(viewingSalary.createdAt).toLocaleString("uz-UZ")}</div></div>
              {viewingSalary.note ? <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><div className="text-sm font-semibold text-[var(--color-muted)]">Izoh</div><div className="mt-1 font-semibold">{viewingSalary.note}</div></div> : null}
            </div>
            <button className="mt-4 h-11 w-full rounded-[14px] border border-[var(--color-border)] text-sm font-black text-[var(--color-text)]" type="button" onClick={() => setViewingSalary(null)}>Yopish</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SupplierEditModal({ supplier, t, onClose, onSave, isPending }: { supplier: Supplier; t: typeof text.uz; onClose: () => void; onSave: (data: { id: string; name: string; phone?: string; contactPerson?: string; category?: string; balance: number }) => void; isPending: boolean }) {
  const [name, setName] = useState(supplier.name);
  const [phone, setPhone] = useState(supplier.phone || "");
  const [contact, setContact] = useState(supplier.contactPerson || "");
  const [cat, setCat] = useState(supplier.category || "");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) { setError("Nom majburiy"); return; }
    onSave({ id: supplier.id, name, phone: phone || undefined, contactPerson: contact || undefined, category: cat || undefined, balance: supplier.balance });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form className="w-full max-w-lg rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-black">{t.edit}</h3>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]" onClick={onClose} type="button"><X size={17} /></button>
        </div>
        {error ? <div className="mb-3 rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-300">{error}</div> : null}
        <div className="grid gap-3">
          <Input placeholder={t.supplierName} value={name} onChange={setName} />
          <Input placeholder={t.phone} value={phone} onChange={setPhone} />
          <Input placeholder={t.contactPerson} value={contact} onChange={setContact} />
          <Input placeholder={t.supplierCategory} value={cat} onChange={setCat} />
        </div>
        <button className="mt-4 h-11 w-full rounded-[14px] bg-[#13EC37] text-sm font-black text-[#121417] disabled:opacity-60" type="submit" disabled={isPending}>{isPending ? "Saqlanmoqda..." : t.save}</button>
      </form>
    </div>
  );
}

function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "red" }) {
  return <span className={tone === "green" ? "w-fit rounded-md bg-emerald-400/15 px-2.5 py-1 text-xs font-black text-emerald-300" : "w-fit rounded-md bg-rose-400/15 px-2.5 py-1 text-xs font-black text-rose-300"}>{children}</span>;
}

function Empty({ t }: { t: typeof text.uz }) {
  return <div className="rounded-[14px] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center text-sm font-bold text-[var(--color-muted)]">{t.empty}</div>;
}

function Input({ value, onChange, placeholder, type = "text", inputMode }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string; inputMode?: "numeric" }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">{placeholder}</span>
      <input className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--color-hint)] focus:border-[#13EC37]" inputMode={inputMode} placeholder={placeholder} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <select className="h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm font-semibold text-[var(--color-text)] outline-none focus:border-[#13EC37]" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
