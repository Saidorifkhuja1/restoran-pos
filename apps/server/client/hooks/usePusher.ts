"use client";

import { useEffect, useRef } from "react";
import Pusher from "pusher-js";
import { subscribeRealtime } from "@/client/lib/realtimeSocket";

let pusherInstance: Pusher | null = null;
const channelSubscriberCounts = new Map<string, number>();

function getPusherInstance(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap1";
  if (!key) return null;

  pusherInstance ??= new Pusher(key, {
    cluster,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
      headers: { "X-RestoPOS-CSRF": "same-origin" },
    },
  });
  return pusherInstance;
}

function subscribePusher<T>(
  channelName: string,
  eventName: string,
  handler: (payload: T) => void
): (() => void) | null {
  const pusher = getPusherInstance();
  if (!pusher) return null;

  const pusherChannelName = `private-${channelName}`;
  const channel = pusher.subscribe(pusherChannelName);
  channel.bind(eventName, handler);
  channelSubscriberCounts.set(
    channelName,
    (channelSubscriberCounts.get(channelName) ?? 0) + 1
  );

  return () => {
    channel.unbind(eventName, handler);
    const remaining = (channelSubscriberCounts.get(channelName) ?? 1) - 1;
    if (remaining > 0) {
      channelSubscriberCounts.set(channelName, remaining);
      return;
    }

    channelSubscriberCounts.delete(channelName);
    pusher.unsubscribe(pusherChannelName);
    if (channelSubscriberCounts.size === 0 && pusherInstance) {
      pusherInstance.disconnect();
      pusherInstance = null;
    }
  };
}

function subscribe<T>(
  channelName: string,
  eventName: string,
  handler: (payload: T) => void
): () => void {
  const unsubscribePusher = subscribePusher(channelName, eventName, handler);
  if (unsubscribePusher) {
    return unsubscribePusher;
  }

  return subscribeRealtime(channelName, eventName, handler);
}

function releaseUnusedPusherInstance(): void {
  if (channelSubscriberCounts.size === 0 && pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
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

    const listener = (payload: T) => handlerRef.current(payload);
    const unsubscribe = subscribe(channelName, eventName, listener);
    return () => {
      unsubscribe();
      releaseUnusedPusherInstance();
    };
  }, [channelName, eventName]);
}
