import { defineConfig } from "vitest/config";

// Client lives in src/client (index.html there). Build output: dist/client,
// served by the Node server in production. In dev, /ws is proxied to the
// server started with `npm run dev:server` (port 8080).
export default defineConfig({
  root: "src/client",
  build: { outDir: "../../dist/client", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/ws": { target: "ws://localhost:8080", ws: true } },
  },
  test: {
    root: ".",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
