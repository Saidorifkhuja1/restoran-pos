"use client";

type RealtimeMessage<T = unknown> = {
  channel: string;
  event: string;
  payload: T;
};

type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 500;

function listenerKey(channel: string, event: string) {
  return `${channel}\u0000${event}`;
}

function connect() {
  if (typeof window === "undefined" || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  if (listeners.size === 0) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  socket.onopen = () => {
    reconnectDelay = 500;
  };
  socket.onmessage = (message) => {
    try {
      const parsed = JSON.parse(message.data) as RealtimeMessage;
      listeners.get(listenerKey(parsed.channel, parsed.event))?.forEach((listener) => listener(parsed.payload));
    } catch {
      // Ignore malformed messages and keep the connection alive.
    }
  };
  socket.onclose = () => {
    socket = null;
    if (listeners.size === 0) return;
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10_000);
  };
  socket.onerror = () => socket?.close();
}

export function subscribeRealtime<T>(channel: string, event: string, handler: (payload: T) => void) {
  const key = listenerKey(channel, event);
  const channelListeners = listeners.get(key) ?? new Set<Listener>();
  channelListeners.add(handler as Listener);
  listeners.set(key, channelListeners);
  connect();

  return () => {
    channelListeners.delete(handler as Listener);
    if (channelListeners.size === 0) listeners.delete(key);
    if (listeners.size === 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      socket?.close();
      socket = null;
    }
  };
}
