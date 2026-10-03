import { describe, it, expect, afterEach } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Address } from "node:net";

import { createStaticHandler } from "./static.ts";

describe("static file handler", () => {
  afterEach(() => {
    process.hrtime.bigint();
  });

  it("/ → 200 html, no-cache", async function () {
    const tmpDir = await mkdtemp(join("/tmp", "static-"));

    await writeFile(join(tmpDir, "index.html"), "<html>OK</html>");

    const server = createServer((req, res) => {
      try {
        const handler = createStaticHandler(tmpDir);
        handler(req, res);
      } catch (e) {
        console.error("server error:", e);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve(0)));

    const port = (server.address() as Address).port;
    const res = await fetch(`http://localhost:${port}/`);
    server.close();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toBe("<html>OK</html>");
  });

  it("/assets/app.js → 200 js, immutable cache", async function () {
    const tmpDir = await mkdtemp(join("/tmp", "static-"));

    await writeFile(join(tmpDir, "index.html"), "<html></html>");
    await writeFile(join(tmpDir, "assets/app.js"), "console.log('js');");

    const server = createServer((req, res) => {
      try {
        const handler = createStaticHandler(tmpDir);
        handler(req, res);
      } catch (e) {
        console.error("server error:", e);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve(0)));

    const port = (server.address() as Address).port;
    const res = await fetch(`http://localhost:${port}/assets/app.js`);
    server.close();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(await res.text()).toBe("console.log('js');");
  });

  it("/some/route → 200 index.html content", async function () {
    const tmpDir = await mkdtemp(join("/tmp", "static-"));

    await writeFile(join(tmpDir, "index.html"), "<html>SUCCESS</html>");

    const server = createServer((req, res) => {
      try {
        const handler = createStaticHandler(tmpDir);
        handler(req, res);
      } catch (e) {
        console.error("server error:", e);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve(0)));

    const port = (server.address() as Address).port;
    const res = await fetch(`http://localhost:${port}/some/route`);
    server.close();

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>SUCCESS</html>");
  });

  it("/../package.json and /%2e%2e/%2e%2e/etc/passwd → 404", async function () {
    const tmpDir = await mkdtemp(join("/tmp", "static-"));

    await writeFile(join(tmpDir, "index.html"), "<html></html>");
    await writeFile(join(tmpDir, "package.json"), '{"name":"bad"}');

    const server = createServer((req, res) => {
      try {
        const handler = createStaticHandler(tmpDir);
        handler(req, res);
      } catch (e) {
        console.error("server error:", e);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve(0)));

    const port = (server.address() as Address).port;

    const res1 = await fetch(`http://localhost:${port}/../package.json`);
    expect(res1.status).toBe(404);

    const res2 = await fetch(
      `http://localhost:${port}/%2e%2e/%2e%2e/etc/passwd`,
    );
    expect(res2.status).toBe(404);

    server.close();
  });

  it("POST / → 405", async function () {
    const tmpDir = await mkdtemp(join("/tmp", "static-"));

    await writeFile(join(tmpDir, "index.html"), "<html></html>");

    const server = createServer((req, res) => {
      try {
        const handler = createStaticHandler(tmpDir);
        handler(req, res);
      } catch (e) {
        console.error("server error:", e);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve(0)));

    const port = (server.address() as Address).port;
    const res = await fetch(`http://localhost:${port}/`, {
      method: "POST",
      body: "",
    });
    server.close();

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });

  it("HEAD /robots.txt → 200, empty body", async function () {
    const tmpDir = await mkdtemp(join("/tmp", "static-"));

    await writeFile(join(tmpDir, "index.html"), "<html></html>");
    await writeFile(join(tmpDir, "robots.txt"), "User-agent: *\nAllow: /");

    const server = createServer((req, res) => {
      try {
        const handler = createStaticHandler(tmpDir);
        handler(req, res);
      } catch (e) {
        console.error("server error:", e);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve(0)));

    const port = (server.address() as Address).port;
    const res = await fetch(
      `http://localhost:${port}/robots.txt`,
      { method: "HEAD" },
    );
    const body = await res.text();
    server.close();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).toBe("");
  });

  it("/%E0%A4%A (bad encoding) → 400", async function () {
    const tmpDir = await mkdtemp(join("/tmp", "static-"));

    await writeFile(join(tmpDir, "index.html"), "<html></html>");

    const server = createServer((req, res) => {
      try {
        const handler = createStaticHandler(tmpDir);
        handler(req, res);
      } catch (e) {
        console.error("server error:", e);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve(0)));

    const port = (server.address() as Address).port;
    const res = await fetch(
      `http://localhost:${port}//%E0%A4%A`,
      { method: "HEAD" },
    );
    server.close();

    expect(res.status).toBe(400);
  });
});
