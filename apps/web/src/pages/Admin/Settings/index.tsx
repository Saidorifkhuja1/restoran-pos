import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData } from "@/api/client";
import { PageTitle, Panel } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

type Restaurant = { name: string; logo?: string | null; phone?: string | null; address?: string | null; taxPercent: number; receiptFooter?: string | null };
type Settings = { kitchenAlertMinutes: number; autoPrintReceipt: boolean; requireGuestCount: boolean; allowDiscount: boolean };

export function SettingsPage() {
  const restaurant = useAuthStore((state) => state.restaurant);
  const queryClient = useQueryClient();
  const restaurantQuery = useQuery({ queryKey: ["admin-restaurant"], queryFn: () => getData<Restaurant>("/admin/restaurant") });
  const settingsQuery = useQuery({ queryKey: ["settings", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Settings>(`/restaurants/${restaurant?.id}/settings`) });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxPercent, setTaxPercent] = useState(12);
  const [receiptFooter, setReceiptFooter] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [kitchenAlertMinutes, setKitchenAlertMinutes] = useState(10);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  useEffect(() => {
    if (restaurantQuery.data) {
      setName(restaurantQuery.data.name);
      setPhone(restaurantQuery.data.phone || "");
      setAddress(restaurantQuery.data.address || "");
      setTaxPercent(restaurantQuery.data.taxPercent);
      setReceiptFooter(restaurantQuery.data.receiptFooter || "");
      setLogo(restaurantQuery.data.logo || null);
    }
  }, [restaurantQuery.data]);
  useEffect(() => {
    if (settingsQuery.data) {
      setKitchenAlertMinutes(settingsQuery.data.kitchenAlertMinutes);
      setAutoPrintReceipt(settingsQuery.data.autoPrintReceipt);
    }
  }, [settingsQuery.data]);
  const saveRestaurant = useMutation({ mutationFn: () => apiClient.put("/admin/restaurant", { name, logo, phone, address, taxPercent, receiptFooter }), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-restaurant"] }) });
  const saveSettings = useMutation({ mutationFn: () => apiClient.put(`/restaurants/${restaurant?.id}/settings`, { kitchenAlertMinutes, autoPrintReceipt }), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["settings"] }) });
  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const response = await apiClient.post<{ data: { url: string } }>("/uploads/cloudinary", form, { headers: { "Content-Type": "multipart/form-data" } });
      return response.data.data.url;
    },
    onSuccess: (url) => setLogo(url),
  });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); saveRestaurant.mutate(); saveSettings.mutate(); }
  return (
    <>
      <PageTitle title="Sozlamalar" subtitle="Restoran ma'lumoti va POS qoidalari" />
      <Panel><form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <div className="md:col-span-2 flex items-center gap-3">
          {logo ? <img className="h-14 w-14 rounded-md border object-cover" src={logo} alt="Restoran logosi" /> : <div className="grid h-14 w-14 place-items-center rounded-md border text-xs text-slate-500">Logo</div>}
          <label className="rounded-md border px-3 py-2 text-sm">
            Logo upload
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadLogo.mutate(file); }} />
          </label>
          {uploadLogo.isPending ? <span className="text-sm text-slate-500">Yuklanmoqda...</span> : null}
        </div>
        <input aria-label="Restoran nomi" className="rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Telefon" className="rounded-md border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input aria-label="Manzil" className="rounded-md border px-3 py-2 md:col-span-2" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input aria-label="QQS foizi" className="rounded-md border px-3 py-2" type="number" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} />
        <input aria-label="KDS alert daqiqasi" className="rounded-md border px-3 py-2" type="number" value={kitchenAlertMinutes} onChange={(e) => setKitchenAlertMinutes(Number(e.target.value))} />
        <textarea aria-label="Chek pastki matni" className="rounded-md border px-3 py-2 md:col-span-2" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoPrintReceipt} onChange={(e) => setAutoPrintReceipt(e.target.checked)} /> Avto print</label>
        <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saveRestaurant.isPending || saveSettings.isPending}>Saqlash</button>
      </form></Panel>
    </>
  );
}
