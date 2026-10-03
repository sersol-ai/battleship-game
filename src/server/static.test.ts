import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStaticHandler } from "./static.ts";

const INDEX_HTML = "<!doctype html><title>battleship</title>";
const APP_JS = "console.log('client');";
const ROBOTS_TXT = "User-agent: *\nDisallow:\n";

interface Served {
  status: number;
  body: string;
  type: string | null;
  cache: string | null;
  allow: string | null;
  nosniff: string | null;
}

/** Build the temp root (index.html, assets/app.js, robots.txt), run `run`, then drop the dir. */
async function withRoot(run: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "static-"));
  try {
    await writeFile(join(rootDir, "index.html"), INDEX_HTML);
    await mkdir(join(rootDir, "assets"));
    await writeFile(join(rootDir, "assets", "app.js"), APP_JS);
    await writeFile(join(rootDir, "robots.txt"), ROBOTS_TXT);
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true });
  }
}

/** One request per server on a random port; the body is read before the socket closes. */
async function fetchFrom(rootDir: string, path: string, method: string): Promise<Served> {
  const server = createServer(createStaticHandler(rootDir));
  server.listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") {
    await server.close();
    throw new Error("server did not bind a port");
  }
  try {
    const res = await fetch(`http://localhost:${address.port}${path}`, { method });
    return {
      status: res.status,
      body: await res.text(),
      type: res.headers.get("content-type"),
      cache: res.headers.get("cache-control"),
      allow: res.headers.get("allow"),
      nosniff: res.headers.get("x-content-type-options"),
    };
  } finally {
    await server.close();
  }
}

describe("static file handler", () => {
  it("/ → 200 html, no-cache", async () => {
    await withRoot(async (rootDir) => {
      const res = await fetchFrom(rootDir, "/", "GET");
      expect(res.status).toBe(200);
      expect(res.type).toBe("text/html; charset=utf-8");
      expect(res.cache).toBe("no-cache");
      expect(res.nosniff).toBe("nosniff");
      expect(res.body).toBe(INDEX_HTML);
    });
  });

  it("/assets/app.js → 200 js, immutable cache", async () => {
    await withRoot(async (rootDir) => {
      const res = await fetchFrom(rootDir, "/assets/app.js", "GET");
      expect(res.status).toBe(200);
      expect(res.type).toBe("text/javascript; charset=utf-8");
      expect(res.cache).toBe("public, max-age=31536000, immutable");
      expect(res.body).toBe(APP_JS);
    });
  });

  it("/some/route → 200 index.html content", async () => {
    await withRoot(async (rootDir) => {
      const res = await fetchFrom(rootDir, "/some/route", "GET");
      expect(res.status).toBe(200);
      expect(res.type).toBe("text/html; charset=utf-8");
      expect(res.cache).toBe("no-cache");
      expect(res.body).toBe(INDEX_HTML);
    });
  });

  it("/missing.png → 404", async () => {
    await withRoot(async (rootDir) => {
      const res = await fetchFrom(rootDir, "/missing.png", "GET");
      expect(res.status).toBe(404);
      expect(res.body).toBe("Not found");
      expect(res.nosniff).toBe("nosniff");
    });
  });

  it("traversal → 404, and nothing outside the root is ever served", async () => {
    await withRoot(async (rootDir) => {
      const traversals = [
        "/../package.json",
        "/../../package.json",
        "/..%2Fpackage.json",
        "/..%2f..%2fetc%2Fpasswd",
      ];
      for (const path of traversals) {
        const res = await fetchFrom(rootDir, path, "GET");
        expect(res.status).toBe(404);
        expect(res.body).toBe("Not found");
      }
      // `fetch` resolves `%2e%2e` before the request is sent, so the server only ever
      // sees `/etc/passwd` — a SPA route. What must hold is that passwd content leaks
      // nowhere: the body is the served index.html.
      const encoded = await fetchFrom(rootDir, "/%2e%2e/%2e%2e/etc/passwd", "GET");
      expect(encoded.body).toBe(INDEX_HTML);
    });
  });

  it("POST / → 405; HEAD /robots.txt → 200, empty body", async () => {
    await withRoot(async (rootDir) => {
      const post = await fetchFrom(rootDir, "/", "POST");
      expect(post.status).toBe(405);
      expect(post.allow).toBe("GET, HEAD");
      expect(post.body).toBe("Method Not Allowed");
      const head = await fetchFrom(rootDir, "/robots.txt", "HEAD");
      expect(head.status).toBe(200);
      expect(head.body).toBe("");
      expect(head.type).toBe("text/plain; charset=utf-8");
    });
  });

  it("/%E0%A4%A (bad encoding) → 400", async () => {
    await withRoot(async (rootDir) => {
      const res = await fetchFrom(rootDir, "/%E0%A4%A", "GET");
      expect(res.status).toBe(400);
      expect(res.body).toBe("Bad Request");
      expect(res.nosniff).toBe("nosniff");
    });
  });

  it("query string is ignored, HEAD on a SPA route sends headers only", async () => {
    await withRoot(async (rootDir) => {
      const withQuery = await fetchFrom(rootDir, "/?next=1", "GET");
      expect(withQuery.status).toBe(200);
      expect(withQuery.body).toBe(INDEX_HTML);
      const headRoute = await fetchFrom(rootDir, "/some/route", "HEAD");
      expect(headRoute.status).toBe(200);
      expect(headRoute.body).toBe("");
      expect(headRoute.type).toBe("text/html; charset=utf-8");
    });
  });
});
