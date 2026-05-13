"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient, getData, Paginated } from "@/client/api/client";
import { PageTitle, Panel, Modal } from "@/client/components/ui";
import { useAuthStore } from "@/client/store/authStore";

type Category = { id: string; name: string; emoji?: string | null };
type MenuItem = { id: string; categoryId: string; name: string; price: number; isAvailable: boolean; category: { name: string } };

const categorySchema = z.object({
  name: z.string().min(2),
  emoji: z.string().max(12).optional(),
});

const itemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2),
  price: z.coerce.number().int().positive(),
  image: z.string().url().optional().or(z.literal("")),
});

type CategoryForm = z.infer<typeof categorySchema>;
type ItemForm = z.infer<typeof itemSchema>;

export function MenuAdminPage() {
  const restaurant = useAuthStore((state) => state.restaurant);
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const createCategoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { name: "", emoji: "" } });
  const editCategoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { name: "", emoji: "" } });
  const createItemForm = useForm<ItemForm>({ resolver: zodResolver(itemSchema), defaultValues: { categoryId: "", name: "", price: 0, image: "" } });
  const editItemForm = useForm<ItemForm>({ resolver: zodResolver(itemSchema), defaultValues: { categoryId: "", name: "", price: 0, image: "" } });
  const categories = useQuery({ queryKey: ["menu-categories", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Paginated<Category>>(`/restaurants/${restaurant?.id}/menu/categories?limit=100`) });
  const items = useQuery({ queryKey: ["menu-admin-items", restaurant?.id], enabled: Boolean(restaurant?.id), queryFn: () => getData<Paginated<MenuItem>>(`/restaurants/${restaurant?.id}/menu/items?limit=100`) });
  const createCategory = useMutation({
    mutationFn: (values: CategoryForm) => apiClient.post(`/restaurants/${restaurant?.id}/menu/categories`, { name: values.name, emoji: values.emoji || undefined }),
    onSuccess: async () => {
      createCategoryForm.reset({ name: "", emoji: "" });
      await queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
    },
  });
  const createItem = useMutation({
    mutationFn: (values: ItemForm) => apiClient.post(`/restaurants/${restaurant?.id}/menu/items`, { categoryId: values.categoryId, name: values.name, price: values.price, image: values.image || undefined }),
    onSuccess: async () => {
      createItemForm.reset({ categoryId: "", name: "", price: 0, image: "" });
      await queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] });
    },
  });
  const updateCategory = useMutation({
    mutationFn: (values: CategoryForm) => apiClient.put(`/restaurants/${restaurant?.id}/menu/categories/${editingCategory?.id}`, { name: values.name, emoji: values.emoji || null }),
    onSuccess: async () => {
      setEditingCategory(null);
      await queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
    },
  });
  const deleteCategory = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurant?.id}/menu/categories/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
      await queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] });
    },
  });
  const updateItem = useMutation({
    mutationFn: (values: ItemForm) => apiClient.put(`/restaurants/${restaurant?.id}/menu/items/${editingItem?.id}`, { name: values.name, price: values.price, categoryId: values.categoryId, image: values.image || null }),
    onSuccess: async () => {
      setEditingItem(null);
      await queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] });
    },
  });
  const deleteItem = useMutation({ mutationFn: (id: string) => apiClient.delete(`/restaurants/${restaurant?.id}/menu/items/${id}`), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] }) });
  async function uploadImage(file: File, target: "create" | "edit") {
    const data = new FormData();
    data.append("file", file);
    data.append("folder", "menu-items");
    const response = await apiClient.post<{ data: { url: string } }>("/uploads/cloudinary", data, { headers: { "Content-Type": "multipart/form-data" } });
    if (target === "create") createItemForm.setValue("image", response.data.data.url, { shouldValidate: true });
    else editItemForm.setValue("image", response.data.data.url, { shouldValidate: true });
  }
  function openCategory(category: Category) {
    setEditingCategory(category);
    editCategoryForm.reset({ name: category.name, emoji: category.emoji || "" });
  }
  function openItem(item: MenuItem) {
    setEditingItem(item);
    editItemForm.reset({ categoryId: item.categoryId, name: item.name, price: item.price, image: "" });
  }
  const createImage = createItemForm.watch("image");
  const editImage = editItemForm.watch("image");
  return (
    <>
      <PageTitle title="Menyu" subtitle="Kategoriya va taomlarni boshqarish" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Panel>
            <form className="space-y-3" onSubmit={createCategoryForm.handleSubmit((values) => createCategory.mutate(values))}>
              <input className="w-full rounded-md border px-3 py-2" placeholder="Kategoriya" {...createCategoryForm.register("name")} />
              <input className="w-full rounded-md border px-3 py-2" placeholder="Emoji" {...createCategoryForm.register("emoji")} />
              <button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={createCategory.isPending}>Kategoriya qo'shish</button>
            </form>
          </Panel>
          <Panel>
            <form className="space-y-3" onSubmit={createItemForm.handleSubmit((values) => createItem.mutate(values))}>
              <select className="w-full rounded-md border px-3 py-2" {...createItemForm.register("categoryId")}>
                <option value="">Kategoriya</option>
                {categories.data?.items.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select>
              <input className="w-full rounded-md border px-3 py-2" placeholder="Taom nomi" {...createItemForm.register("name")} />
              <input className="w-full rounded-md border px-3 py-2" type="number" placeholder="Narx" {...createItemForm.register("price")} />
              <input className="w-full rounded-md border px-3 py-2 text-sm" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], "create")} />
              {createImage ? <div className="text-xs text-emerald-700">Rasm yuklandi</div> : null}
              <button className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={createItem.isPending}>Taom qo'shish</button>
            </form>
          </Panel>
        </div>
        <Panel>
          <div className="mb-3 font-semibold">Kategoriyalar</div>
          {categories.data?.items.map((category) => <div className="flex items-center justify-between border-b py-3" key={category.id}><span>{category.emoji} {category.name}</span><div className="flex gap-2"><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openCategory(category)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteCategory.mutate(category.id)}>Delete</button></div></div>)}
          <div className="mb-3 mt-6 font-semibold">Taomlar</div>
          {items.data?.items.map((item) => <div className="flex items-center justify-between border-b py-3" key={item.id}><div><div className="font-medium">{item.name}</div><div className="text-sm text-slate-500">{item.category.name}</div></div><div className="flex items-center gap-2"><div className="text-sm font-semibold">{item.price.toLocaleString("uz-UZ")} UZS</div><button className="rounded-md border px-2 py-1 text-xs" onClick={() => openItem(item)}>Edit</button><button className="rounded-md border px-2 py-1 text-xs text-rose-700" onClick={() => deleteItem.mutate(item.id)}>Delete</button></div></div>)}
        </Panel>
      </div>
      {editingCategory ? <Modal title="Kategoriyani tahrirlash" onClose={() => setEditingCategory(null)}><form className="space-y-3" onSubmit={editCategoryForm.handleSubmit((values) => updateCategory.mutate(values))}><input className="w-full rounded-md border px-3 py-2" {...editCategoryForm.register("name")} /><input className="w-full rounded-md border px-3 py-2" {...editCategoryForm.register("emoji")} /><button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={updateCategory.isPending}>Saqlash</button></form></Modal> : null}
      {editingItem ? <Modal title="Taomni tahrirlash" onClose={() => setEditingItem(null)}><form className="space-y-3" onSubmit={editItemForm.handleSubmit((values) => updateItem.mutate(values))}><select className="w-full rounded-md border px-3 py-2" {...editItemForm.register("categoryId")}>{categories.data?.items.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><input className="w-full rounded-md border px-3 py-2" {...editItemForm.register("name")} /><input className="w-full rounded-md border px-3 py-2" type="number" {...editItemForm.register("price")} /><input className="w-full rounded-md border px-3 py-2 text-sm" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], "edit")} />{editImage ? <div className="text-xs text-emerald-700">Yangi rasm yuklandi</div> : null}<button className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={updateItem.isPending}>Saqlash</button></form></Modal> : null}
    </>
  );
}
