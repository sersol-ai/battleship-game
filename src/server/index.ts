import { startServer } from "./app.ts";
import { resolve } from "node:path";

const FORCE_EXIT_MS = 5_000;

const port = Number(process.env.PORT ?? 8080);
const staticDir = process.env.STATIC_DIR ?? resolve(import.meta.dirname, "../client");

const server = await startServer({ port, staticDir });

async function shutdown(): Promise<void> {
  const forceTimer = setTimeout(() => {
    process.exit(1);
  }, FORCE_EXIT_MS);
  try {
    await server.close();
  } catch {
    clearTimeout(forceTimer);
    process.exit(1);
  }
  clearTimeout(forceTimer);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
