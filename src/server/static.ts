import type { IncomingMessage, ServerResponse } from "node:http";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve, sep, extname } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

function contentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
}

function cacheControl(pathname: string): string {
  return pathname.startsWith("/assets/") ? IMMUTABLE_CACHE : "no-cache";
}

/** `lstat` (not `stat`) so a symlink can never point outside the served root. */
async function readRegularFile(path: string): Promise<Buffer | null> {
  try {
    const stats = await lstat(path);
    if (!stats.isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

export function createStaticHandler(
  rootDir: string,
): (req: IncomingMessage, res: ServerResponse) => void {
  const root = resolve(rootDir);

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const nosniff = { "X-Content-Type-Options": "nosniff" };

    function fail(status: number, body: string, extra: Record<string, string>): void {
      res.writeHead(status, { ...nosniff, ...extra });
      res.end(body);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      fail(405, "Method Not Allowed", { Allow: "GET, HEAD" });
      return;
    }

    let pathname: string;
    try {
      const url = new URL(req.url ?? "/", "http://x");
      const requested = decodeURIComponent((req.url ?? "/").replace(/[?#].*/, ""));
      // `new URL` folds `..` segments into the path, so a traversal attempt would
      // otherwise reach the SPA fallback and answer 200. Reject it with 404, and
      // reject anything whose host is not the base (absolute / protocol-relative URLs).
      if (url.host !== "x" || requested.split("/").some((s) => s === "." || s === "..")) {
        fail(404, "Not found", {});
        return;
      }
      pathname = decodeURIComponent(url.pathname);
    } catch {
      fail(400, "Bad Request", {});
      return;
    }

    if (pathname === "/" || pathname === "") pathname = "/index.html";

    const target = join(root, pathname);
    if (!target.startsWith(root + sep)) {
      fail(404, "Not found", {});
      return;
    }

    function send(body: Buffer, filePath: string): void {
      res.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Content-Length": String(body.length),
        "Cache-Control": cacheControl(pathname),
        ...nosniff,
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(body);
    }

    const body = await readRegularFile(target);
    if (body !== null) {
      send(body, target);
      return;
    }

    if (extname(pathname) !== "") {
      fail(404, "Not found", {});
      return;
    }

    const index = await readRegularFile(join(root, "index.html"));
    if (index !== null) {
      send(index, join(root, "index.html"));
      return;
    }

    fail(404, "Not found", {});
  }

  return (req: IncomingMessage, res: ServerResponse): void => {
    route(req, res).catch(() => undefined);
  };
}
