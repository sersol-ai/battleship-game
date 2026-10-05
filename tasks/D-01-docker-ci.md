# D-01 — Dockerfile + CI workflow

Role: devops · Depends on: T-16, Q-01 · Size: M

## Goal

A small production image and a GitHub Actions pipeline that proves every push works.
Docker is NOT installed on the dev machine — the image is verified in CI only.

## Read first

- `docs/ARCHITECTURE.md` sections 5 and 6
- `package.json`

## Files

- create `Dockerfile`, `.dockerignore`
- create `.github/workflows/ci.yml`

## Spec — Dockerfile (use exactly this)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "dist/server/index.js"]
```

`.dockerignore`: `node_modules`, `dist`, `.git`, `.pi`, `tasks`, `docs`, `e2e`, `playwright-report`, `test-results`, `*.md`.

## Spec — .github/workflows/ci.yml

Triggers: `push` to any branch, `pull_request`. `permissions: contents: read`. Jobs:

1. **check** (ubuntu-latest): `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: 22`, `cache: npm`),
   `npm ci`, `npm run check`, `npm run build`.
2. **e2e** (needs check): same setup, `npx playwright install --with-deps chromium`, `npx playwright test`
   with `env: CI: "true"`; on failure upload `playwright-report/` via `actions/upload-artifact@v4`.
3. **docker** (needs check): `docker/setup-buildx-action@v3`, `docker/build-push-action@v6` with
   `push: false`, `load: true`, `tags: battleship-game:ci`; then smoke test:
   ```bash
   docker run -d --name bs -p 8080:8080 battleship-game:ci
   for i in $(seq 1 20); do curl -fsS localhost:8080/healthz && exit 0; sleep 1; done
   docker logs bs; exit 1
   ```
   plus `curl -fsS localhost:8080/ | grep -q '<div\|<main'` to prove static files are served.

## Acceptance

- `npm run check` green locally (prettier checks the YAML too).
- After the architect pushes to GitHub: all three CI jobs green. Record the run URL in Coder notes.

## Coder notes

- `Dockerfile` is the spec text verbatim: two `node:22-alpine` stages, build stage does `npm ci` + `npm run build`, runtime reinstalls with `--omit=dev --ignore-scripts`, copies `/app/dist`, runs as `node` on 8080.
- `.dockerignore` is exactly the 10 entries the spec lists (so `tasks/`, `docs/`, `e2e/`, `*.md` never reach the build context, and `dist` is rebuilt in-image).
- `ci.yml`: `check` (checkout, setup-node 22 + npm cache, `npm ci`, `npm run check`, `npm run build`) → `e2e` (`CI: "true"` so playwright never reuses a server; report uploaded only on failure) → `docker` (buildx, build-push `push: false`/`load: true`/`tags: battleship-game:ci`, then the smoke test).
- Smoke test: polls `/healthz` up to 20 times, then proves static serving with `curl / | grep -q '<div\|<main'`; only that path exits 0, every failure prints `docker logs bs` and exits 1. I wrote the poll as `if curl ...; then ok=1; break; fi` rather than the spec's `curl && exit 0` because Actions runs scripts under `bash -eo pipefail`, where a failed `curl && exit 0` kills the script before the log dump. Verified both branches locally with stubbed `curl`/`docker`.
- Docker is not installed on this machine, so nothing was built or run here — the image is proven by CI only. I cannot see Actions results: architect, please record the `ci` workflow run URL (all three jobs green) here.
- `npm run check` final line: `Test Files  21 passed (21) / Tests  199 passed (199)` (typecheck + `prettier --check .` + vitest all green; prettier has no parser for `Dockerfile`/`.dockerignore`, so it silently skips them — `ci.yml` is checked and clean).

## Questions for architect

## Review
