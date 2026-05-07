import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  hydrated: boolean;
  setAuth: (payload: { user: AuthUser; restaurant?: AuthRestaurant | null }) => void;
  setHydrated: (hydrated: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      restaurant: null,
      hydrated: false,
      setAuth: (payload) => {
        set({
          user: payload.user,
          restaurant: payload.restaurant || null,
          hydrated: true,
        });
      },
      setHydrated: (hydrated) => set({ hydrated }),
      logout: () => {
        set({ user: null, restaurant: null, hydrated: true });
      },
    }),
    {
      name: "restopos-auth",
      partialize: (state) => ({
        restaurant: state.restaurant,
      }),
    }
  )
);
