"use client";

import { useEffect, useRef, useCallback } from "react";
import Pusher from "pusher-js";

// Singleton Pusher instance — prevents creating a new WebSocket per hook call
let pusherInstance: Pusher | null = null;
let subscriberCount = 0;

function getPusherInstance(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";
  if (!key) return null;

  if (!pusherInstance) {
    pusherInstance = new Pusher(key, { cluster });
  }
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

type EventHandler<T> = (payload: T) => void;

export function usePusherEvent<T>(
  channelName: string | null | undefined,
  eventName: string,
  handler: EventHandler<T>
) {
  // Stabilise handler reference to prevent re-subscriptions on every render
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback((payload: T) => {
    handlerRef.current(payload);
  }, []);

  useEffect(() => {
    if (!channelName) return undefined;

    const pusher = getPusherInstance();
    if (!pusher) return undefined;

    subscriberCount += 1;
    const channel = pusher.subscribe(channelName);
    channel.bind(eventName, stableHandler);

    return () => {
      channel.unbind(eventName, stableHandler);
      pusher.unsubscribe(channelName);
      releasePusherInstance();
    };
  }, [channelName, eventName, stableHandler]);
}
