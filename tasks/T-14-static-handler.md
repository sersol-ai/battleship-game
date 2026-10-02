# T-14 — Static file handler

Role: coder · Depends on: — · Size: S

## Goal

Serve the built client (`dist/client`) safely from Node with SPA fallback.

## Read first

- `docs/ARCHITECTURE.md` section 5 (Server)

## Files

- create `src/server/static.ts`
- create `src/server/static.test.ts`

## Spec

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
export function createStaticHandler(
  rootDir: string,
): (req: IncomingMessage, res: ServerResponse) => void;
```

Behaviour (use `node:fs/promises`, `node:path`; no dependencies):

1. Method not GET/HEAD → 405, header `Allow: GET, HEAD`.
2. Take the pathname from `new URL(req.url ?? "/", "http://x")`; `decodeURIComponent` (on error → 400).
3. `/` → `/index.html`. Resolve `path.join(root, pathname)`; if the result does not start with
   `root + path.sep` → 404 (path traversal).
4. If it is an existing regular file → 200 with `Content-Type` from the map below (unknown →
   `application/octet-stream`), `Content-Length`, and `Cache-Control`:
   `public, max-age=31536000, immutable` if pathname starts with `/assets/`, else `no-cache`.
   HEAD sends headers only.
5. Otherwise, if the pathname has a file extension (`path.extname` non-empty) → 404 text `Not found`.
6. Otherwise (SPA route) → serve `index.html` as in step 4.
7. Add to every response: `X-Content-Type-Options: nosniff`.

Content types: `.html text/html; charset=utf-8`, `.js text/javascript; charset=utf-8`,
`.css text/css; charset=utf-8`, `.json application/json`, `.svg image/svg+xml`, `.png image/png`,
`.ico image/x-icon`, `.woff2 font/woff2`, `.txt text/plain; charset=utf-8`, `.webmanifest application/manifest+json`.

## Tests (static.test.ts)

Create a temp dir (`fs.mkdtemp(path.join(os.tmpdir(), "static-"))`) with `index.html`,
`assets/app.js`, `robots.txt`. Start `http.createServer(handler)` on port 0; use `fetch`.

1. `/` → 200 html, `no-cache`.
2. `/assets/app.js` → 200 js, immutable cache.
3. `/some/route` → 200 index.html content.
4. `/missing.png` → 404.
5. `/../package.json`, `/%2e%2e/%2e%2e/etc/passwd` → 404 (and never outside root).
6. POST `/` → 405. HEAD `/robots.txt` → 200, empty body.
7. `/%E0%A4%A` (bad encoding) → 400.

## Acceptance

`npm run format && npm run check` green.

## Out of scope

`/healthz`, WebSocket (T-16).

## Coder notes

## Questions for architect

## Review
