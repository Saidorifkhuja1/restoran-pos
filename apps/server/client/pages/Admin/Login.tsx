"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { useAuthStore, AuthRestaurant, AuthUser } from "@/client/store/authStore";
import { UserRole } from "@restopos/types";

type LoginResponse = {
  user: AuthUser;
  restaurant: AuthRestaurant;
  token: string;
};

const loginSchema = z.object({
  login: z.string().min(2, "Login kerak"),
  password: z.string().min(4, "Parol kamida 4 ta belgi bo'lishi kerak"),
});

type LoginForm = z.infer<typeof loginSchema>;

function homePathByRole(role: AuthUser["role"]): string {
  if (role === UserRole.ADMIN || role === UserRole.MANAGER) return "/admin/dashboard";
  if (role === UserRole.CASHIER) return "/cashier";
  if (role === UserRole.KITCHEN) return "/kitchen";
  // WAITER
  return "/tables";
}

export function AdminLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    try {
      const response = await apiClient.post<ApiEnvelope<LoginResponse>>("/auth/login", values);
      const { user, restaurant, token } = response.data.data;
      setAuth({ user, restaurant, token });
      window.location.href = homePathByRole(user.role);
    } catch (error) {
      const message = axios.isAxiosError<{ error?: string }>(error)
        ? error.response?.data?.error
        : undefined;
      form.setError("root", { message: message || "Login yoki parol noto'g'ri" });
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#050916] p-4 text-white">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-[24px] border border-[#243655] bg-[#111a2b] p-6 shadow-2xl"
      >
        <h1 className="text-2xl font-black">RestoPOS</h1>
        <p className="mb-6 mt-1 text-sm font-medium text-slate-400">
          Restoran boshqaruv tizimiga kirish
        </p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-bold text-slate-300">Ism</span>
          <input
            className="w-full rounded-[14px] border border-[#2a4167] bg-[#0b1220] px-3 py-3 font-semibold text-white outline-none focus:border-[#13EC37]"
            placeholder="Xodim ismi"
            autoComplete="username"
            {...form.register("login")}
          />
          {form.formState.errors.login?.message ? (
            <span className="mt-1 block text-xs text-rose-400">
              {form.formState.errors.login.message}
            </span>
          ) : null}
        </label>

        <label className="mb-5 block text-sm">
          <span className="mb-1 block font-bold text-slate-300">Parol</span>
          <input
            className="w-full rounded-[14px] border border-[#2a4167] bg-[#0b1220] px-3 py-3 font-semibold text-white outline-none focus:border-[#13EC37]"
            type="password"
            placeholder="Parol"
            autoComplete="current-password"
            {...form.register("password")}
          />
          {form.formState.errors.password?.message ? (
            <span className="mt-1 block text-xs text-rose-400">
              {form.formState.errors.password.message}
            </span>
          ) : null}
        </label>

        {form.formState.errors.root?.message ? (
          <p className="mb-3 rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <button
          disabled={form.formState.isSubmitting}
          className="w-full rounded-[14px] bg-[#13EC37] px-3 py-3 text-sm font-black text-[#121417] transition active:scale-[0.99] disabled:opacity-60"
        >
          {form.formState.isSubmitting ? "Kirilmoqda..." : "Kirish"}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          SuperAdmin?{" "}
          <a href="/superadmin/login" className="text-[#13EC37] hover:underline">
            Bu yerdan kiring
          </a>
        </p>
      </form>
    </main>
  );
}
