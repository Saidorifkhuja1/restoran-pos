"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel, Modal } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";

type Category = { id: string; name: string; emoji?: string | null };
type MenuItem = { id: string; categoryId: string; name: string; price: number; isAvailable: boolean; category: { name: string } };

export function MenuAdminPage() {
  const restaurant = useAuthStore((state) => state.restaurant);
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryEmoji, setEditCategoryEmoji] = useState("");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemPrice, setEditItemPrice] = useState(0);
  const [editItemCategoryId, setEditItemCategoryId] = useState("");
  const [editItemImage, setEditItemImage] = useState("");
  const categories = useQuery({ queryKey: ["menu-categories", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Paginated<Category>>(`/restaurants/${restaurant?.id}/menu/categories?limit=100`) });
  const items = useQuery({ queryKey: ["menu-admin-items", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Paginated<MenuItem>>(`/restaurants/${restaurant?.id}/menu/items?limit=100`) });
  const createCategory = useMutation({ mutationFn: () => apiClient.post(`/restaurants/${restaurant?.id}/menu/categories`, { name: categoryName, emoji: emoji || undefined }), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["menu-categories"] }) });
  const createItem = useMutation({ mutationFn: () => apiClient.post(`/restaurants/${restaurant?.id}/menu/items`, { categoryId, name: itemName, price, image: image || undefined }), onSuccess: async () => { setImage(""); await queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] }); } });
  const updateCategory = useMutation({ mutationFn: () => apiClient.put(`/restaurants/${restaurant?.id}/menu/categories/${editingCategory?.id}`, { name: editCategoryName, emoji: editCategoryEmoji || null }), onSuccess: async () => { setEditingCategory(null); await queryClient.invalidateQueries({ queryKey: ["menu-categories"] }); } });
  const deleteCategory = useMutation({ mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurant?.id}/menu/categories/${id}`), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["menu-categories"] }); await queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] }); } });
  const updateItem = useMutation({ mutationFn: () => apiClient.put(`/restaurants/${restaurant?.id}/menu/items/${editingItem?.id}`, { name: editItemName, price: editItemPrice, categoryId: editItemCategoryId, image: editItemImage || null }), onSuccess: async () => { setEditingItem(null); await queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] }); } });
  const deleteItem = useMutation({ mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurant?.id}/menu/items/${id}`), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] }) });
  function submitCategory(event: FormEvent<HTMLFormElement>) { event.preventDefault(); createCategory.mutate(); }
  function submitItem(event: FormEvent<HTMLFormElement>) { event.preventDefault(); createItem.mutate(); }
  function openCategory(category: Category) { setEditingCategory(category); setEditCategoryName(category.name); setEditCategoryEmoji(category.emoji || ""); }
  async function uploadImage(file: File, target: "create" | "edit") {
    const data = new FormData();
    data.append("file", file);
    data.append("folder", "menu-items");
    const response = await apiClient.post<{ data: { url: string } }>("/uploads/cloudinary", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (target === "create") setImage(response.data.data.url);
    else setEditItemImage(response.data.data.url);
  }
  function openItem(item: MenuItem) { setEditingItem(item); setEditItemName(item.name); setEditItemPrice(item.price); setEditItemCategoryId(item.categoryId); setEditItemImage(""); }
  return (
    <>
      <PageTitle title="Menyu" subtitle="Kategoriya va taomlarni boshqarish" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Panel><form className="space-y-3" onSubmit={submitCategory}><input className="w-full rounded-md border px-3 py-2" placeholder="Kategoriya" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /><input className="w-full rounded-md border px-3 py-2" placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Kategoriya qo'shish</button></form></Panel>
          <Panel><form className="space-y-3" onSubmit={submitItem}><select className="w-full rounded-md border px-3 py-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Kategoriya</option>{categories.data?.items.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><input className="w-full rounded-md border px-3 py-2" placeholder="Taom nomi" value={itemName} onChange={(e) => setItemName(e.target.value)} /><input className="w-full rounded-md border px-3 py-2" type="number" placeholder="Narx" value={price} onChange={(e) => setPrice(Number(e.target.value))} /><input className="w-full rounded-md border px-3 py-2 text-sm" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "create")} />{image ? <div className="text-xs text-emerald-700">Rasm yuklandi</div> : null}<button className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Taom qo'shish</button></form></Panel>
        </div>
        <Panel>
          <div className="mb-3 font-semibold">Kategoriyalar</div>
          {categories.data?.items.map((category) => <div className="flex items-center justify-between border-b py-3" key={category.id}><span>{category.emoji} {category.name}</span><div className="flex gap-2"><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openCategory(category)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteCategory.mutate(category.id)}>Delete</button></div></div>)}
          <div className="mb-3 mt-6 font-semibold">Taomlar</div>
          {items.data?.items.map((item) => <div className="flex items-center justify-between border-b py-3" key={item.id}><div><div className="font-medium">{item.name}</div><div className="text-sm text-slate-500">{item.category.name}</div></div><div className="flex items-center gap-2"><div className="text-sm font-semibold">{item.price.toLocaleString("uz-UZ")} UZS</div><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openItem(item)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteItem.mutate(item.id)}>Delete</button></div></div>)}
        </Panel>
      </div>
      {editingCategory ? <Modal title="Kategoriyani tahrirlash" onClose={() => setEditingCategory(null)}><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); updateCategory.mutate(); }}><input className="w-full rounded-md border px-3 py-2" value={editCategoryName} onChange={(event) => setEditCategoryName(event.target.value)} /><input className="w-full rounded-md border px-3 py-2" value={editCategoryEmoji} onChange={(event) => setEditCategoryEmoji(event.target.value)} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button></form></Modal> : null}
      {editingItem ? <Modal title="Taomni tahrirlash" onClose={() => setEditingItem(null)}><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); updateItem.mutate(); }}><select className="w-full rounded-md border px-3 py-2" value={editItemCategoryId} onChange={(event) => setEditItemCategoryId(event.target.value)}>{categories.data?.items.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><input className="w-full rounded-md border px-3 py-2" value={editItemName} onChange={(event) => setEditItemName(event.target.value)} /><input className="w-full rounded-md border px-3 py-2" type="number" value={editItemPrice} onChange={(event) => setEditItemPrice(Number(event.target.value))} /><input className="w-full rounded-md border px-3 py-2 text-sm" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "edit")} />{editItemImage ? <div className="text-xs text-emerald-700">Yangi rasm yuklandi</div> : null}<button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Saqlash</button></form></Modal> : null}
    </>
  );
}
