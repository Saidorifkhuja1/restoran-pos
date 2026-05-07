import Pusher from "pusher";

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER || "ap1";

export const pusher =
  appId && key && secret
    ? new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: true,
      })
    : null;

export async function publishEvent<T>(
  channel: string,
  event: string,
  payload: T
): Promise<void> {
  if (!pusher) {
    return;
  }

  await pusher.trigger(channel, event, payload);
}

export function restaurantChannel(restaurantId: string): string {
  return `restaurant:${restaurantId}`;
}

export function kitchenChannel(restaurantId: string): string {
  return `kitchen:${restaurantId}`;
}

export function cashierChannel(restaurantId: string): string {
  return `cashier:${restaurantId}`;
}
