# D-03 — Deploy to Portainer (portainer-iac repo)

Role: **architect-run** (Claude Code in `~/portainer-iac`), NOT the small coder model · Depends on: D-02 + first release

portainer-iac has many non-obvious gotchas (documented in its CLAUDE.md); this task touches shared
infra (Traefik restarts every proxied host). Do it with a strong model and read that CLAUDE.md first.

## Steps

1. Issue-first: `gh issue create --repo sersol-ai/portainer-iac --title "Add battleship stack"` with this plan.
2. Create `battleship/docker-compose.yml` (single container, `garmin-mcp/` as template):
   ```yaml
   name: battleship
   services:
     battleship:
       container_name: battleship
       image: ghcr.io/sersol-ai/battleship-game:<X.Y.Z>@sha256:<digest> # pinned HERE, not in stack.env
       restart: unless-stopped
       ports:
         - "${BATTLESHIP_HOST_PORT:-8090}:8080"
       healthcheck:
         test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]
         interval: 30s
         timeout: 3s
         retries: 3
   ```
   and `battleship/stack.env` with `BATTLESHIP_HOST_PORT=8090` + header comment (no secrets, no volumes,
   in-memory state — a redeploy ends running games).
3. CLAUDE.md port list: add `8090 — battleship`. README/CLAUDE.md stack lists: add `battleship`.
4. `traefik/dynamic/dynamic-config.yml`: add router `battleship` with rule
   ``Host(`battleship.sonic.wtf`)``, `entryPoints: [websecure]`, `tls: {}`, and service `battleship` →
   `http://10.0.99.200:8090`. No auth middleware (public game).
   **Bump `TRAEFIK_RESTART_TOKEN`** in `traefik/docker-compose.yml` in the same push.
5. Optional: gatus endpoint for `https://battleship.sonic.wtf/healthz`.
6. Commit (`Closes #N`), push, then `deploy_stack_git` for `battleship` (never `update_stack`).
7. Verify: `curl https://battleship.sonic.wtf/healthz`; play one online game across two devices
   (confirms WebSocket through Traefik).

## Subsequent releases

Bump the `image:` tag+digest in `battleship/docker-compose.yml` and push — Portainer's poll redeploys.
Optionally add `battleship` to portainer-iac's Renovate config so it opens the bump PR itself.
