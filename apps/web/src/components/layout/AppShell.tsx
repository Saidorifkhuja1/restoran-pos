import { NavLink, Outlet } from "react-router-dom";
import { apiClient } from "@/api/client";
import { ShiftControls } from "@/components/layout/ShiftControls";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { useAuthStore } from "@/store/authStore";

const links = [
  { to: "/tables", label: "Stollar", roles: ["ADMIN", "MANAGER", "WAITER"] },
  { to: "/orders", label: "Buyurtma", roles: ["ADMIN", "MANAGER", "WAITER"] },
  { to: "/kitchen", label: "KDS", roles: ["ADMIN", "MANAGER", "KITCHEN"] },
  { to: "/cashier", label: "Kassa", roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { to: "/reservations", label: "Bron", roles: ["ADMIN", "MANAGER", "WAITER"] },
  { to: "/admin", label: "Admin", roles: ["ADMIN", "MANAGER"] },
  { to: "/admin/staff", label: "Xodimlar", roles: ["ADMIN"] },
  { to: "/admin/zones", label: "Zonalar", roles: ["ADMIN", "MANAGER"] },
  { to: "/admin/menu", label: "Menyu", roles: ["ADMIN", "MANAGER"] },
  { to: "/admin/discounts", label: "Chegirma", roles: ["ADMIN"] },
  { to: "/admin/expenses", label: "Xarajat", roles: ["ADMIN", "MANAGER"] },
  { to: "/admin/reports", label: "Hisobot", roles: ["ADMIN", "MANAGER"] },
  { to: "/admin/audit", label: "Audit", roles: ["ADMIN", "MANAGER"] },
  { to: "/admin/settings", label: "Sozlama", roles: ["ADMIN"] },
] as const;

export function AppShell() {
  const { user, restaurant, logout } = useAuthStore();
  useRealtimeInvalidation();
  const visibleLinks = links.filter((link) => user && link.roles.includes(user.role as never));
  async function handleLogout() {
    await apiClient.post("/auth/logout").catch(() => undefined);
    logout();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-lg font-semibold">RestoPOS</div>
          <div className="text-sm text-slate-500">{restaurant?.name || user?.name}</div>
        </div>
        <nav className="space-y-1 p-3">
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div>
            <div className="text-sm font-semibold">{user?.name}</div>
            <div className="text-xs text-slate-500">{user?.role}</div>
          </div>
          <div className="flex items-center gap-2">
            <ShiftControls />
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" onClick={handleLogout}>
              Chiqish
            </button>
          </div>
        </header>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
