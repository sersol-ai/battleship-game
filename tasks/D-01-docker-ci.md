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

## Questions for architect

## Review
