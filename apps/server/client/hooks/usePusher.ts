"use client";

import { useEffect, useRef } from "react";
import Pusher from "pusher-js";

let pusherInstance: Pusher | null = null;
let subscriberCount = 0;

function getPusherInstance(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap1";
  if (!key) return null;

  pusherInstance ??= new Pusher(key, { cluster });
  return pusherInstance;
}

function releasePusherInstance(): void {
  subscriberCount -= 1;
  if (subscriberCount <= 0 && pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
    subscriberCount = 0;
  }
}

export function usePusherEvent<T = unknown>(
  channelName: string | null | undefined,
  eventName: string,
  handler: (payload: T) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!channelName) return undefined;

    const pusher = getPusherInstance();
    if (!pusher) return undefined;

    subscriberCount += 1;
    const channel = pusher.subscribe(channelName);

    const listener = (payload: T) => handlerRef.current(payload);
    channel.bind(eventName, listener);

    return () => {
      channel.unbind(eventName, listener);
      pusher.unsubscribe(channelName);
      releasePusherInstance();
    };
  }, [channelName, eventName]);
}
