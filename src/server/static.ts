import type { IncomingMessage, ServerResponse } from "node:http";
import * as fs from "node:fs";
import { join, resolve, extname } from "node:path";

const ContentType: Record<string, string> = {
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

function CacheControl(normPathname: string): string {
  return normPathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
}

export function createStaticHandler(
  rootDir: string,
): (req: IncomingMessage, res: ServerResponse) => void {
  const rootResolved = resolve(rootDir);
  const rootResolvedTrailing = rootResolved + "/";

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(req.url ?? "");
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request");
      return;
    }

    const absPath = pathname
      ? join(rootResolved, pathname.replace(/\/+$/, ""))
      : rootResolved;

    const resolved = absPath;
    if (!resolved.startsWith(rootResolvedTrailing)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const st = fs.existsSync(resolved)
      ? fs.statSync(resolved)
      : undefined;

    if (st?.isFile()) {
      const ext = extname(pathname) || "";
      const ctype = ContentType[ext] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Length": String(st.size),
        "Content-Type": ctype,
        "Cache-Control": CacheControl(pathname || ""),
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    const ext = extname(pathname);
    if (ext) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const indexPath = join(resolved, "index.html");
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      res.writeHead(200, {
        "Content-Type": ContentType[".html"],
        "Cache-Control": CacheControl(pathname || ""),
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  };

  return handler;
}
