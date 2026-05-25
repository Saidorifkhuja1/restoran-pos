"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Crown, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { AuthUser, useAuthStore } from "@/client/store/authStore";

type LoginResponse = {
  superAdmin: { id: string; email: string; name: string };
};

const superAdminLoginSchema = z.object({
  email: z.string().email("Email noto'g'ri"),
  password: z.string().min(6, "Parol kamida 6 belgi"),
});

type SuperAdminLoginForm = z.infer<typeof superAdminLoginSchema>;

export function SuperAdminLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const form = useForm<SuperAdminLoginForm>({
    resolver: zodResolver(superAdminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SuperAdminLoginForm) {
    try {
      const response = await apiClient.post<ApiEnvelope<LoginResponse>>("/superadmin/auth/login", values);
      const user: AuthUser = {
        id: response.data.data.superAdmin.id,
        name: response.data.data.superAdmin.name,
        email: response.data.data.superAdmin.email,
        role: "SUPERADMIN",
      };
      setAuth({ user });
      window.location.href = "/superadmin/dashboard";
    } catch {
      form.setError("root", { message: "Email yoki parol noto'g'ri" });
    }
  }

  return (
    <main className="min-h-screen bg-[#070b16] p-4 text-slate-100">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_430px]">
        <section className="hidden lg:block">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#13EC37]/15 text-[#13EC37]">
            <Crown size={28} />
          </div>
          <h1 className="max-w-xl text-5xl font-black tracking-normal text-white">RestoPOS SuperAdmin</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-400">
            Restoranlar, adminlar va platforma nazoratini bitta paneldan boshqaring.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[#263854] bg-[#101a2b] p-4">
              <ShieldCheck className="mb-4 text-[#13EC37]" size={24} />
              <div className="font-bold">Platform guard</div>
              <div className="mt-1 text-sm text-slate-400">Faqat SUPERADMIN kiradi</div>
            </div>
            <div className="rounded-[18px] border border-[#263854] bg-[#101a2b] p-4">
              <LockKeyhole className="mb-4 text-[#13EC37]" size={24} />
              <div className="font-bold">Secure session</div>
              <div className="mt-1 text-sm text-slate-400">httpOnly cookie auth</div>
            </div>
          </div>
        </section>

        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full rounded-[24px] border border-[#263854] bg-[#101a2b] p-6 shadow-2xl">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#13EC37]/15 text-[#13EC37]">
              <Crown size={24} />
            </div>
            <h2 className="text-2xl font-black tracking-normal text-white">SuperAdmin kirish</h2>
            <p className="mt-1 text-sm text-slate-400">Platforma boshqaruv paneli</p>
          </div>

          <label className="mb-2 block text-sm font-bold text-slate-300">Email</label>
          <div className="mb-1 flex h-12 items-center gap-3 rounded-[14px] border border-[#263854] bg-[#0b1220] px-3 focus-within:border-[#13EC37]">
            <Mail size={18} className="text-slate-500" />
            <input className="superadmin-login-input h-full min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600" placeholder="superadmin@restopos.uz" type="email" {...form.register("email")} />
          </div>
          <p className="mb-3 min-h-4 text-xs text-rose-300">{form.formState.errors.email?.message}</p>

          <label className="mb-2 block text-sm font-bold text-slate-300">Parol</label>
          <div className="mb-1 flex h-12 items-center gap-3 rounded-[14px] border border-[#263854] bg-[#0b1220] px-3 focus-within:border-[#13EC37]">
            <LockKeyhole size={18} className="text-slate-500" />
            <input className="superadmin-login-input h-full min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600" placeholder="Parol" type="password" {...form.register("password")} />
          </div>
          <p className="mb-3 min-h-4 text-xs text-rose-300">{form.formState.errors.password?.message}</p>

          <div className="mb-4 rounded-[16px] border border-[#263854] bg-[#0b1220] p-3 text-sm">
            <div className="font-bold text-slate-200">Demo kirish</div>
            <div className="mt-1 text-slate-400">Email: superadmin@restopos.uz</div>
            <div className="text-slate-400">Parol: Super12345</div>
          </div>

          {form.formState.errors.root?.message ? <p className="mb-3 rounded-[12px] bg-rose-400/10 px-3 py-2 text-sm text-rose-300">{form.formState.errors.root.message}</p> : null}
          <button disabled={form.formState.isSubmitting} className="h-12 w-full rounded-[16px] bg-[#13EC37] px-3 text-sm font-black text-[#121417] transition active:scale-[0.99] disabled:opacity-60">
            {form.formState.isSubmitting ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>
      </div>
    </main>
  );
}
