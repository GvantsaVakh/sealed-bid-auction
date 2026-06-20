import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],

  define: {
    global: "globalThis",
  },

  assetsInclude: ["**/*.wasm"],

  server: {
    port: 5173,
    fs: {
      allow: ["."],
    },
  },

  optimizeDeps: {
    exclude: [
      "@zama-fhe/relayer-sdk",
      "@zama-fhe/relayer-sdk/web",
      "@zama-fhe/relayer-sdk/bundle",
      "tfhe",
      "tkms",
      "node-tfhe",
      "node-tkms",
    ],
    include: [
    "buffer",
    "process",
    "events",
    "util",
    "stream-browserify",
    "keccak",
    "keccak/js.js",
    "fetch-retry",
    "fetch-retry/dist/fetch-retry.umd.js",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});