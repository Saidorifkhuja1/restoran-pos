"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, getData } from "@/client/api/client";
import { PageTitle, Panel } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";

type Restaurant = { name: string; logo?: string | null; phone?: string | null; address?: string | null; taxPercent: number; receiptFooter?: string | null };
type Settings = { kitchenAlertMinutes: number; autoPrintReceipt: boolean; requireGuestCount: boolean; allowDiscount: boolean };

const settingsSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxPercent: z.coerce.number().min(0).max(100),
  receiptFooter: z.string().optional(),
  logo: z.string().url().nullable().optional(),
  kitchenAlertMinutes: z.coerce.number().int().positive(),
  autoPrintReceipt: z.boolean(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const restaurant = useAuthStore((state) => state.restaurant);
  const queryClient = useQueryClient();
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      taxPercent: 12,
      receiptFooter: "",
      logo: null,
      kitchenAlertMinutes: 10,
      autoPrintReceipt: false,
    },
  });
  const restaurantQuery = useQuery({ queryKey: ["admin-restaurant"], queryFn: () => getData<Restaurant>("/admin/restaurant") });
  const settingsQuery = useQuery({ queryKey: ["settings", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Settings>(`/restaurants/${restaurant?.id}/settings`) });
  useEffect(() => {
    const current = form.getValues();
    form.reset({
      ...current,
      name: restaurantQuery.data?.name ?? current.name,
      phone: restaurantQuery.data?.phone || "",
      address: restaurantQuery.data?.address || "",
      taxPercent: restaurantQuery.data?.taxPercent ?? current.taxPercent,
      receiptFooter: restaurantQuery.data?.receiptFooter || "",
      logo: restaurantQuery.data?.logo || null,
      kitchenAlertMinutes: settingsQuery.data?.kitchenAlertMinutes ?? current.kitchenAlertMinutes,
      autoPrintReceipt: settingsQuery.data?.autoPrintReceipt ?? current.autoPrintReceipt,
    });
  }, [form, restaurantQuery.data, settingsQuery.data]);
  const saveRestaurant = useMutation({
    mutationFn: (values: SettingsForm) => apiClient.put("/admin/restaurant", { name: values.name, logo: values.logo, phone: values.phone || undefined, address: values.address || undefined, taxPercent: values.taxPercent, receiptFooter: values.receiptFooter || undefined }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-restaurant"] }),
  });
  const saveSettings = useMutation({
    mutationFn: (values: SettingsForm) => apiClient.put(`/restaurants/${restaurant?.id}/settings`, { kitchenAlertMinutes: values.kitchenAlertMinutes, autoPrintReceipt: values.autoPrintReceipt }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const response = await apiClient.post<{ data: { url: string } }>("/uploads/cloudinary", uploadForm, { headers: { "Content-Type": "multipart/form-data" } });
      return response.data.data.url;
    },
    onSuccess: (url) => form.setValue("logo", url, { shouldValidate: true }),
  });
  async function submit(values: SettingsForm) {
    await Promise.all([saveRestaurant.mutateAsync(values), saveSettings.mutateAsync(values)]);
  }
  const logo = form.watch("logo");
  return (
    <>
      <PageTitle title="Sozlamalar" subtitle="Restoran ma'lumoti va POS qoidalari" />
      <Panel><form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
        <div className="flex items-center gap-3 md:col-span-2">
          {logo ? <img className="h-14 w-14 rounded-md border object-cover" src={logo} alt="Restoran logosi" /> : <div className="grid h-14 w-14 place-items-center rounded-md border text-xs text-slate-500">Logo</div>}
          <label className="rounded-md border px-3 py-2 text-sm">
            Logo upload
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadLogo.mutate(file); }} />
          </label>
          {uploadLogo.isPending ? <span className="text-sm text-slate-500">Yuklanmoqda...</span> : null}
        </div>
        <input aria-label="Restoran nomi" className="rounded-md border px-3 py-2" {...form.register("name")} />
        <input aria-label="Telefon" className="rounded-md border px-3 py-2" {...form.register("phone")} />
        <input aria-label="Manzil" className="rounded-md border px-3 py-2 md:col-span-2" {...form.register("address")} />
        <input aria-label="QQS foizi" className="rounded-md border px-3 py-2" type="number" {...form.register("taxPercent")} />
        <input aria-label="KDS alert daqiqasi" className="rounded-md border px-3 py-2" type="number" {...form.register("kitchenAlertMinutes")} />
        <textarea aria-label="Chek pastki matni" className="rounded-md border px-3 py-2 md:col-span-2" {...form.register("receiptFooter")} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("autoPrintReceipt")} /> Avto print</label>
        <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saveRestaurant.isPending || saveSettings.isPending}>Saqlash</button>
      </form></Panel>
    </>
  );
}
