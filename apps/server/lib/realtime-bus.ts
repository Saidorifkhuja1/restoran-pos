import { EventEmitter } from "node:events";

export type RealtimeMessage = {
  channel: string;
  event: string;
  payload: unknown;
};

type RealtimeGlobal = typeof globalThis & {
  __restoposRealtimeBus?: EventEmitter;
};

const realtimeGlobal = globalThis as RealtimeGlobal;

export const realtimeBus =
  realtimeGlobal.__restoposRealtimeBus ?? new EventEmitter();

realtimeBus.setMaxListeners(0);
realtimeGlobal.__restoposRealtimeBus = realtimeBus;

export function emitRealtime(message: RealtimeMessage): void {
  realtimeBus.emit("message", message);
}
