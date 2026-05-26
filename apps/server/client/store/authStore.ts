"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { UserRole } from "@restopos/types";

export type AuthRole = UserRole | "SUPERADMIN";

export type AuthUser = {
  id: string;
  name: string;
  role: AuthRole;
  phone?: string | null;
  email?: string;
};

export type AuthRestaurant = {
  id: string;
  name: string;
  currency: string;
  taxPercent: number;
};

type AuthState = {
  user: AuthUser | null;
  restaurant: AuthRestaurant | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (payload: { user: AuthUser; restaurant?: AuthRestaurant | null; token?: string }) => void;
  setHydrated: (hydrated: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      restaurant: null,
      token: null,
      hydrated: false,
      setAuth: (payload) => {
        set((state) => ({
          user: payload.user,
          restaurant: payload.restaurant || null,
          token: payload.token ?? state.token,
          hydrated: true,
        }));
      },
      setHydrated: (hydrated) => set({ hydrated }),
      logout: () => {
        set({ user: null, restaurant: null, token: null, hydrated: true });
      },
    }),
    {
      name: "restopos-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        restaurant: state.restaurant,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
