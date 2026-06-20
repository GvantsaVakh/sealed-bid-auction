/// <reference types="vite/client" />

import type { Buffer } from "buffer";
import type process from "process";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (eventName: string, callback: (...args: unknown[]) => void) => void;
      removeListener?: (eventName: string, callback: (...args: unknown[]) => void) => void;
    };
  }

  var Buffer: typeof Buffer;
  var process: typeof process;
  var global: typeof globalThis;
}

declare module "@zama-fhe/relayer-sdk/web";

export {};
