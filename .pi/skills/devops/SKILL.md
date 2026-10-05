---
name: devops
description: Docker, GitHub Actions and release conventions for this Battleship repo. Use when writing or editing the Dockerfile, .dockerignore, .github/workflows/*, RELEASING.md, or the portainer-iac deploy (D-XX tasks).
---

# DevOps (Docker + CI + release)

## Setup facts

- Docker is NOT installed on the dev machine. Never try `docker build`/`docker run` locally: the
  image is verified in CI only (D-01 acceptance says so).
- `npm run check` runs prettier over the whole repo, including `.github/workflows/*.yml` and new
  `.md` files. YAML must be prettier-clean (2-space indent, no tabs) or CI's check job fails.
- No new npm dependencies. The runtime image installs exactly `ws` (`npm ci --omit=dev`).
- Ports: container listens on `8080` (`ENV PORT=8080`); the host maps `8090 -> 8080`.

## Files (only touch what the task's "Files" section lists)

- D-01: `Dockerfile`, `.dockerignore`, `.github/workflows/ci.yml`
- D-02: `.github/workflows/release.yml`, `RELEASING.md`
- D-03: NOT here — it lives in `~/portainer-iac` and is run by the architect, who must read that
  repo's `CLAUDE.md` first.

Never edit `docs/*` (contract). Release instructions go in `RELEASING.md` (<= 25 lines).

## Image contract (D-01)

Two stages, both `node:22-alpine`:

1. build stage: `WORKDIR /app`, copy `package.json package-lock.json`, `npm ci`, `COPY . .`,
   `npm run build`.
2. runtime: `ENV NODE_ENV=production PORT=8080`, `npm ci --omit=dev --ignore-scripts` +
   `npm cache clean --force`, `COPY --from=build /app/dist ./dist`, `USER node`, `EXPOSE 8080`,
   `HEALTHCHECK ... wget -qO- http://127.0.0.1:8080/healthz || exit 1`,
   `CMD ["node", "dist/server/index.js"]`.

`.dockerignore`: `node_modules`, `dist`, `.git`, `.pi`, `tasks`, `docs`, `e2e`,
`playwright-report`, `test-results`, `*.md`.

## CI contract (ci.yml)

Triggers `push` (any branch) + `pull_request`; `permissions: contents: read`. Jobs:

1. **check**: checkout@v4, setup-node@v4 (`node-version: 22`, `cache: npm`), `npm ci`,
   `npm run check`, `npm run build`.
2. **e2e** (after check): `npx playwright install --with-deps chromium`, `npx playwright test`
   with `env: CI: "true"` (so `reuseExistingServer` is off and the reporter is CI-safe); on failure
   upload `playwright-report/` with `actions/upload-artifact@v4`.
3. **docker** (after check): buildx + build-push with `push: false`, `load: true`,
   `tags: battleship-game:ci`, then smoke test — `docker run -d --name bs -p 8080:8080`, poll
   `curl -fsS localhost:8080/healthz` up to 20 times, `curl -fsS localhost:8080/ | grep -q '<div\|<main'`
   (proves static files are served), print `docker logs bs`, `exit 1` so a green run is the only
   pass path.

## Release contract (release.yml, D-02)

- Trigger `push` on tags `v*.*.*`; `permissions: { contents: read, packages: write }`.
- Run `npm ci` + `npm run check` before publishing — never publish a broken build.
- `docker/login-action@v3` ghcr.io with `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}`.
- `docker/metadata-action@v5` on `ghcr.io/${{ github.repository }}`: semver `{{version}}`,
  `{{major}}.{{minor}}`, `raw,value=latest`.
- `docker/build-push-action@v6`: `push: true`, `platforms: linux/amd64`, GHA layer cache
  (`cache-from: type=gha`, `cache-to: type=gha,mode=max`).
- Echo `steps.<build-id>.outputs.digest` into `$GITHUB_STEP_SUMMARY` — the digest is what D-03 pins.
- First release only: set the GHCR package to Public (Portainer pulls without credentials).

## Deploy gotchas (portainer-iac, D-03)

- Issue-first (`gh issue create`), reference `Closes #N` in the commit.
- Pin `image: ghcr.io/sersol-ai/battleship-game:<X.Y.Z>@sha256:<digest>` in
  `battleship/docker-compose.yml` — NOT in `stack.env` (Portainer's poller does not re-read it).
- Traefik: add router + service in `traefik/dynamic/dynamic-config.yml` AND bump
  `TRAEFIK_RESTART_TOKEN` in `traefik/docker-compose.yml` in the same push, or the route never
  reloads.
- `deploy_stack_git` once; never `update_stack`. Subsequent releases = bump tag+digest and push
  (the poller redeploys).
- Verify with `curl https://battleship.sonic.wtf/healthz` plus one online game on two devices
  (WebSocket through Traefik needs no extra config, but prove it).

## Done means

- `npm run check` green locally (this covers the YAML you wrote).
- For CI-visible work: paste the Actions run URL in the task's "Coder notes"; for D-02, the pushed
  digest too.
