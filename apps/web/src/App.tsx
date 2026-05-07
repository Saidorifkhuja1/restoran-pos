import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard, defaultPathForRole } from "@/components/layout/AuthGuard";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { AuditPage } from "@/pages/Admin/Audit";
import { AdminDashboard } from "@/pages/Admin/Dashboard";
import { DiscountsPage } from "@/pages/Admin/Discounts";
import { ExpensesPage } from "@/pages/Admin/Expenses";
import { AdminLogin } from "@/pages/Admin/Login";
import { MenuAdminPage } from "@/pages/Admin/Menu";
import { ReportsPage } from "@/pages/Admin/Reports";
import { SettingsPage } from "@/pages/Admin/Settings";
import { StaffPage } from "@/pages/Admin/Staff";
import { ZonesPage } from "@/pages/Admin/Zones";
import { CashierPage } from "@/pages/Cashier";
import { KitchenPage } from "@/pages/Kitchen";
import { OrderPage } from "@/pages/Order";
import { ReservationsPage } from "@/pages/Reservations";
import { SuperAdminDashboard } from "@/pages/SuperAdmin/Dashboard";
import { SuperAdminRestaurantDetail } from "@/pages/SuperAdmin/RestaurantDetail";
import { SuperAdminLogin } from "@/pages/SuperAdmin/Login";
import { TablesPage } from "@/pages/Tables";
import { useAuthStore } from "@/store/authStore";
import { UserRole } from "@restopos/types";

export function App() {
  const user = useAuthStore((state) => state.user);
  return (
    <>
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route
        path="/superadmin"
        element={
          <AuthGuard roles={["SUPERADMIN"]}>
            <SuperAdminDashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/superadmin/restaurants/:id"
        element={
          <AuthGuard roles={["SUPERADMIN"]}>
            <SuperAdminRestaurantDetail />
          </AuthGuard>
        }
      />
      <Route
        path="/"
        element={
          <AuthGuard roles={[UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER]}>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to={user ? defaultPathForRole(user.role) : "/tables"} replace />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/staff" element={<StaffPage />} />
        <Route path="admin/zones" element={<ZonesPage />} />
        <Route path="admin/menu" element={<MenuAdminPage />} />
        <Route path="admin/discounts" element={<DiscountsPage />} />
        <Route path="admin/expenses" element={<ExpensesPage />} />
        <Route path="admin/audit" element={<AuditPage />} />
        <Route path="admin/reports" element={<ReportsPage />} />
        <Route path="admin/settings" element={<SettingsPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="orders/:orderId?" element={<OrderPage />} />
        <Route path="kitchen" element={<KitchenPage />} />
        <Route path="cashier" element={<CashierPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/tables" replace />} />
    </Routes>
    <PwaUpdatePrompt />
    </>
  );
}
