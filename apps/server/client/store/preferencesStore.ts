"use client";

import { create } from "zustand";

export type Language = "uz" | "ru";
export type ThemeMode = "auto" | "light" | "dark";

type PreferencesState = {
  settings: {
    language: Language;
    themeMode: ThemeMode;
  };
  updateSettings: (partial: Partial<{ language: Language; themeMode: ThemeMode }>) => void;
};

const STORAGE_KEY = "app_settings";

function loadSettings(): PreferencesState["settings"] {
  if (typeof window === "undefined") return { themeMode: "auto", language: "uz" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { themeMode: "auto", language: "uz" };
    const parsed = JSON.parse(raw) as Partial<PreferencesState["settings"]>;
    return {
      themeMode: parsed.themeMode && ["auto", "light", "dark"].includes(parsed.themeMode) ? parsed.themeMode : "auto",
      language: parsed.language && ["uz", "ru"].includes(parsed.language) ? parsed.language : "uz",
    };
  } catch {
    return { themeMode: "auto", language: "uz" };
  }
}

function applyTheme(themeMode: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (themeMode === "auto") {
    root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
    return;
  }
  root.classList.toggle("dark", themeMode === "dark");
}

export const usePreferencesStore = create<PreferencesState>()(
  (set, get) => ({
    settings: loadSettings(),
    updateSettings: (partial) => {
      const next = { ...get().settings, ...partial };
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (partial.themeMode) applyTheme(partial.themeMode);
      set({ settings: next });
    },
  })
);

export const dictionary = {
  uz: {
    back: "Ortga",
    profile: "Profil",
    shifts: "Smenalar",
    logout: "Chiqish",
    receipts: "Cheklar",
    name: "Ism",
    role: "Rol",
    phone: "Telefon",
    loading: "Yuklanmoqda...",
    active: "Faol",
    closed: "Yopilgan",
    sales: "Savdo",
    orders: "Buyurtma",
    noShift: "Smena topilmadi.",
    noReceipts: "Bu smenada chek yo'q.",
    sections: "Bo'limlar",
    selectTablePlace: "Stol joylashuvini tanlang",
    cabins: "Kabinetlar",
    hall: "Zal",
    street: "Ko'cha",
    tables: "Stollar",
    table: "Stol",
    people: "kishi",
    open: "Ochish",
    emptySection: "Bu bo'limda stol yo'q.",
    order: "Buyurtma",
    menuAndCart: "Menyu va savatcha",
    all: "Barchasi",
    add: "Qo'shish",
    cart: "Savatcha",
    selectTable: "Stol tanlang",
    total: "Jami",
    sendKitchen: "Oshxonaga yuborish",
    sending: "Yuborilmoqda...",
    statusFree: "Bo'sh",
    statusOccupied: "Band",
    statusReserved: "Band qilingan",
    statusBillRequested: "Hisob so'ralgan",
    statusOpen: "Yaratildi",
    statusInKitchen: "Yaratildi",
    statusReady: "Berildi",
    statusBill: "Berildi",
    statusPaid: "To'landi",
    statusCancelled: "Bekor qilindi",
  },
  ru: {
    back: "Назад",
    profile: "Профиль",
    shifts: "Смены",
    logout: "Выйти",
    receipts: "Чеки",
    name: "Имя",
    role: "Роль",
    phone: "Телефон",
    loading: "Загрузка...",
    active: "Активная",
    closed: "Закрыта",
    sales: "Продажи",
    orders: "Заказы",
    noShift: "Смены не найдены.",
    noReceipts: "В этой смене чеков нет.",
    sections: "Разделы",
    selectTablePlace: "Выберите расположение стола",
    cabins: "Кабинеты",
    hall: "Зал",
    street: "Улица",
    tables: "Столы",
    table: "Стол",
    people: "чел.",
    open: "Открыть",
    emptySection: "В этом разделе столов нет.",
    order: "Заказ",
    menuAndCart: "Меню и корзина",
    all: "Все",
    add: "Добавить",
    cart: "Корзина",
    selectTable: "Выберите стол",
    total: "Итого",
    sendKitchen: "Отправить на кухню",
    sending: "Отправляется...",
    statusFree: "Свободно",
    statusOccupied: "Занято",
    statusReserved: "Забронировано",
    statusBillRequested: "Счёт запрошен",
    statusOpen: "Создан",
    statusInKitchen: "Создан",
    statusReady: "Выдан",
    statusBill: "Выдан",
    statusPaid: "Оплачен",
    statusCancelled: "Отменён",
  },
} as const;
