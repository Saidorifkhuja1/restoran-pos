import { useEffect } from "react";
import Pusher from "pusher-js";

type EventHandler<T> = (payload: T) => void;

export function usePusherEvent<T>(
  channelName: string | null | undefined,
  eventName: string,
  handler: EventHandler<T>
) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";
    if (!key || !channelName) return undefined;

    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe(channelName);
    channel.bind(eventName, handler);

    return () => {
      channel.unbind(eventName, handler);
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [channelName, eventName, handler]);
}
