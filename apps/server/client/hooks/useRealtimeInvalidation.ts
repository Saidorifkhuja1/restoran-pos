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
    void queryClient.invalidateQueries({ queryKey: ["cashier-pending"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-report"] });
  };
  const invalidateTables = () => {
    void queryClient.invalidateQueries({ queryKey: ["tables"] });
  };
  const invalidateReservations = () => {
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
    invalidateTables();
  };

  usePusherEvent(restaurantChannel, "order:created", invalidateOrders);
  usePusherEvent(restaurantChannel, "order:updated", invalidateOrders);
  usePusherEvent(restaurantChannel, "table:status", invalidateTables);
  usePusherEvent(restaurantChannel, "reservation:created", invalidateReservations);
  usePusherEvent(restaurantChannel, "reservation:updated", invalidateReservations);
  usePusherEvent(kitchenChannel, "new-order", invalidateOrders);
  usePusherEvent(kitchenChannel, "item-cancelled", invalidateOrders);
  usePusherEvent(cashierChannel, "bill-requested", invalidateOrders);
  usePusherEvent(cashierChannel, "payment-done", invalidateOrders);
}
