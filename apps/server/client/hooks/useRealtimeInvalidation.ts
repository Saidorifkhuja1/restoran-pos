"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/client/store/authStore";
import { usePusherEvent } from "@/client/hooks/usePusher";

export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const restaurant = useAuthStore((state) => state.restaurant);
  const restaurantChannel = restaurant?.id ? `restaurant:${restaurant.id}` : null;
  const kitchenChannel = restaurant?.id ? `kitchen:${restaurant.id}` : null;
  const cashierChannel = restaurant?.id ? `cashier:${restaurant.id}` : null;

  const invalidate = (...queryKeys: string[]) => {
    for (const queryKey of queryKeys) {
      void queryClient.invalidateQueries({ queryKey: [queryKey] });
    }
  };

  const invalidateOrders = () => {
    invalidate(
      "orders",
      "order",
      "active-orders",
      "cashier-all-orders",
      "kitchen-orders",
      "cashier-pending",
      "admin-overview",
      "shifts-page",
      "shift-page-receipts",
      "waiter-profile-receipts"
    );
  };
  const invalidateTables = () => {
    invalidate("tables", "cashier-tables", "admin-overview");
  };
  const invalidateReservations = () => {
    invalidate("reservations");
    invalidateTables();
  };
  const invalidateMenu = () => {
    invalidate(
      "menu-items",
      "menu-admin-items",
      "menu-categories",
      "cashier-menu",
      "cashier-menu-categories",
      "admin-overview"
    );
  };
  const invalidateAdminData = () => {
    invalidate(
      "admin-staff",
      "admin-profile",
      "admin-overview",
      "cashier-staff",
      "zones",
      "cashier-zones",
      "discounts",
      "cashier-discounts",
      "expenses",
      "suppliers",
      "salaries",
      "admin-restaurant",
      "settings",
      "cashier-settings",
      "audit",
      "admin-report",
      "report-today"
    );
  };
  const invalidateShifts = () => {
    invalidate(
      "current-shift",
      "shifts-page",
      "shift-page-receipts",
      "admin-overview",
      "admin-report",
      "report-today"
    );
  };

  usePusherEvent(restaurantChannel, "order:created", invalidateOrders);
  usePusherEvent(restaurantChannel, "order:updated", invalidateOrders);
  usePusherEvent(restaurantChannel, "table:status", invalidateTables);
  usePusherEvent(restaurantChannel, "reservation:created", invalidateReservations);
  usePusherEvent(restaurantChannel, "reservation:updated", invalidateReservations);
  usePusherEvent(restaurantChannel, "reservation:deleted", invalidateReservations);
  usePusherEvent(restaurantChannel, "menu:updated", invalidateMenu);
  usePusherEvent(restaurantChannel, "staff:updated", invalidateAdminData);
  usePusherEvent(restaurantChannel, "zone:updated", () => {
    invalidateAdminData();
    invalidateTables();
  });
  usePusherEvent(restaurantChannel, "discount:updated", invalidateAdminData);
  usePusherEvent(restaurantChannel, "expense:updated", invalidateAdminData);
  usePusherEvent(restaurantChannel, "supplier:updated", invalidateAdminData);
  usePusherEvent(restaurantChannel, "salary:updated", invalidateAdminData);
  usePusherEvent(restaurantChannel, "settings:updated", invalidateAdminData);
  usePusherEvent(restaurantChannel, "restaurant:updated", invalidateAdminData);
  usePusherEvent(restaurantChannel, "shift:updated", invalidateShifts);
  usePusherEvent(kitchenChannel, "new-order", invalidateOrders);
  usePusherEvent(kitchenChannel, "item-cancelled", invalidateOrders);
  usePusherEvent(kitchenChannel, "kitchen:item-done", invalidateOrders);
  usePusherEvent(cashierChannel, "bill-requested", invalidateOrders);
  usePusherEvent(cashierChannel, "payment-done", () => {
    invalidateOrders();
    invalidateShifts();
  });
}
