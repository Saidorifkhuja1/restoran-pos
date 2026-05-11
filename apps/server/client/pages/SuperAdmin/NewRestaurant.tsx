"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient } from "@/client/api/client";
import { PageTitle, Panel } from "@/client/components/ui";

const newRestaurantSchema = z.object({
  name: z.string().min(2, "Restoran nomi kerak"),
  type: z.string().min(2, "Restoran turi kerak"),
  adminName: z.string().min(2, "Admin ismi kerak"),
  adminPhone: z.string().min(5, "Telefon kerak"),
  adminPin: z.string().regex(/^\d{4}$/, "PIN 4 raqam bo'lishi kerak"),
});

type NewRestaurantForm = z.infer<typeof newRestaurantSchema>;

export function NewRestaurantPage() {
  const router = useRouter();
  const form = useForm<NewRestaurantForm>({
    resolver: zodResolver(newRestaurantSchema),
    defaultValues: { name: "", type: "", adminName: "", adminPhone: "", adminPin: "" },
  });

  const createRestaurant = useMutation({
    mutationFn: (payload: NewRestaurantForm) => apiClient.post("/superadmin/restaurants", payload),
    onSuccess: () => router.push("/superadmin/restaurants"),
  });

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <PageTitle title="Yangi restoran" subtitle="Restoran ma'lumoti va birinchi admin user" />
        <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm" href="/superadmin/restaurants">
          Orqaga
        </Link>
      </div>
      <Panel>
        <form className="grid max-w-2xl gap-4" onSubmit={form.handleSubmit((values) => createRestaurant.mutate(values))}>
          {createRestaurant.isError ? <p className="text-sm text-rose-600">Restoran yaratishda xatolik yuz berdi</p> : null}
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Restoran nomi</span>
            <input className="rounded-md border px-3 py-2" {...form.register("name")} />
            <span className="text-xs text-rose-600">{form.formState.errors.name?.message}</span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Turi</span>
            <input className="rounded-md border px-3 py-2" {...form.register("type")} />
            <span className="text-xs text-rose-600">{form.formState.errors.type?.message}</span>
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Admin ismi</span>
              <input className="rounded-md border px-3 py-2" {...form.register("adminName")} />
              <span className="text-xs text-rose-600">{form.formState.errors.adminName?.message}</span>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Admin telefon</span>
              <input className="rounded-md border px-3 py-2" {...form.register("adminPhone")} />
              <span className="text-xs text-rose-600">{form.formState.errors.adminPhone?.message}</span>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Admin PIN</span>
              <input className="rounded-md border px-3 py-2" inputMode="numeric" maxLength={4} {...form.register("adminPin")} />
              <span className="text-xs text-rose-600">{form.formState.errors.adminPin?.message}</span>
            </label>
          </div>
          <button disabled={createRestaurant.isPending} className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {createRestaurant.isPending ? "Yaratilmoqda..." : "Restoran yaratish"}
          </button>
        </form>
      </Panel>
    </main>
  );
}
