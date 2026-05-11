"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  const router = useRouter();
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
      router.replace("/superadmin/dashboard");
    } catch {
      form.setError("root", { message: "Email yoki parol noto'g'ri" });
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-950">
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-sm rounded-md bg-white p-5 shadow-sm">
        <h1 className="mb-4 text-2xl font-semibold">SuperAdmin</h1>
        <input className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Email" type="email" {...form.register("email")} />
        <p className="mb-2 min-h-4 text-xs text-rose-600">{form.formState.errors.email?.message}</p>
        <input className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Parol" type="password" {...form.register("password")} />
        <p className="mb-2 min-h-4 text-xs text-rose-600">{form.formState.errors.password?.message}</p>
        {form.formState.errors.root?.message ? <p className="mb-3 text-sm text-rose-600">{form.formState.errors.root.message}</p> : null}
        <button disabled={form.formState.isSubmitting} className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Kirish</button>
      </form>
    </main>
  );
}
