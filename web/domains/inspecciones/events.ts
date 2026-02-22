import type { InspeccionDiaria } from "./types";

export type InspeccionEventType = "created" | "updated" | "finalized";

export type InspeccionChangeEvent = {
  type: InspeccionEventType;
  inspeccion: InspeccionDiaria;
  emittedAt: number;
};

type Listener = (event: InspeccionChangeEvent) => void;

const listeners = new Set<Listener>();
const CHANNEL_NAME = "inspecciones-diarias-updates";
let channel: BroadcastChannel | null = null;

const getChannel = () => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (channel) {
    return channel;
  }
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (message: MessageEvent<InspeccionChangeEvent>) => {
    const data = message.data;
    if (!data || !data.type || !data.inspeccion) {
      return;
    }
    listeners.forEach((listener) => listener(data));
  };
  return channel;
};

export const publishInspeccionEvent = (
  type: InspeccionEventType,
  inspeccion: InspeccionDiaria
) => {
  const event: InspeccionChangeEvent = {
    type,
    inspeccion,
    emittedAt: Date.now(),
  };
  listeners.forEach((listener) => listener(event));
  getChannel()?.postMessage(event);
};

export const subscribeInspeccionEvents = (listener: Listener) => {
  listeners.add(listener);
  getChannel();
  return () => {
    listeners.delete(listener);
  };
};
