// src/types/window.d.ts
export {};

declare global {
  interface Window {
    fbq?: (action: string, eventName: string, params?: Record<string, unknown>) => void;
    _fbq?: unknown;
  }
}
