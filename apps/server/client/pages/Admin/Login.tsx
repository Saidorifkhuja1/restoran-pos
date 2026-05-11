"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, ApiEnvelope } from "@/client/api/client";
import { useAuthStore, AuthRestaurant, AuthUser } from "@/client/store/authStore";

type LoginResponse = {
  user: AuthUser;
  restaurant: AuthRestaurant;
};

const pinLoginSchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID kerak"),
  pin: z.string().regex(/^\d{4}$/, "PIN 4 raqam bo'lishi kerak"),
});

type PinLoginForm = z.infer<typeof pinLoginSchema>;

export function AdminLogin() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const form = useForm<PinLoginForm>({
    resolver: zodResolver(pinLoginSchema),
    defaultValues: { restaurantId: "", pin: "" },
  });

  async function onSubmit(values: PinLoginForm) {
    try {
      const response = await apiClient.post<ApiEnvelope<LoginResponse>>("/auth/login", values);
      setAuth(response.data.data);
      router.replace("/tables");
    } catch {
      form.setError("root", { message: "Restaurant ID yoki PIN noto'g'ri" });
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="mb-4 text-2xl font-semibold">RestoPOS</h1>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Restaurant ID</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" {...form.register("restaurantId")} />
          <span className="mt-1 block text-xs text-rose-600">{form.formState.errors.restaurantId?.message}</span>
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-slate-600">PIN</span>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" inputMode="numeric" maxLength={4} {...form.register("pin")} />
          <span className="mt-1 block text-xs text-rose-600">{form.formState.errors.pin?.message}</span>
        </label>
        {form.formState.errors.root?.message ? <p className="mb-3 text-sm text-rose-600">{form.formState.errors.root.message}</p> : null}
        <button disabled={form.formState.isSubmitting} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Kirish
        </button>
      </form>
    </main>
  );
}
