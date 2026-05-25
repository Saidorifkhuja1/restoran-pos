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

  const invalidateOrders = () => {
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["order"] });
    void queryClient.invalidateQueries({ queryKey: ["active-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["cashier-pending"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-report"] });
    void queryClient.invalidateQueries({ queryKey: ["report-today"] });
    void queryClient.invalidateQueries({ queryKey: ["shifts-page"] });
    void queryClient.invalidateQueries({ queryKey: ["shift-page-receipts"] });
  };
  const invalidateTables = () => {
    void queryClient.invalidateQueries({ queryKey: ["tables"] });
  };
  const invalidateReservations = () => {
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
    invalidateTables();
  };
  const invalidateMenu = () => {
    void queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    void queryClient.invalidateQueries({ queryKey: ["menu-admin-items"] });
    void queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
  };
  const invalidateAdminData = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    void queryClient.invalidateQueries({ queryKey: ["zones"] });
    void queryClient.invalidateQueries({ queryKey: ["discounts"] });
    void queryClient.invalidateQueries({ queryKey: ["expenses"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-restaurant"] });
    void queryClient.invalidateQueries({ queryKey: ["settings"] });
    void queryClient.invalidateQueries({ queryKey: ["audit"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-report"] });
    void queryClient.invalidateQueries({ queryKey: ["report-today"] });
  };
  const invalidateShifts = () => {
    void queryClient.invalidateQueries({ queryKey: ["current-shift"] });
    void queryClient.invalidateQueries({ queryKey: ["shifts-page"] });
    void queryClient.invalidateQueries({ queryKey: ["shift-page-receipts"] });
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
