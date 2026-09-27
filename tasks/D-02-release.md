# D-02 — Release workflow (GHCR image)

Role: devops · Depends on: D-01 · Size: S

## Goal

Pushing a git tag `vX.Y.Z` publishes `ghcr.io/sersol-ai/battleship-game:X.Y.Z` (and `:latest`).

## Read first

- `.github/workflows/ci.yml`

## Files

- create `.github/workflows/release.yml`
- modify `docs/` — NO. Put release instructions in `RELEASING.md` (create it).

## Spec — release.yml

- Trigger: `push: tags: ["v*.*.*"]`.
- `permissions: { contents: read, packages: write }`.
- Steps: checkout; setup-node 22 + `npm ci` + `npm run check` (never publish a broken build);
  `docker/setup-buildx-action@v3`; `docker/login-action@v3` (registry `ghcr.io`, username
  `${{ github.actor }}`, password `${{ secrets.GITHUB_TOKEN }}`); `docker/metadata-action@v5` with
  `images: ghcr.io/${{ github.repository }}` and tags `type=semver,pattern={{version}}`,
  `type=semver,pattern={{major}}.{{minor}}`, `type=raw,value=latest`;
  `docker/build-push-action@v6` with `push: true`, `platforms: linux/amd64`, tags/labels from metadata,
  `cache-from: type=gha`, `cache-to: type=gha,mode=max`.
- Final step prints the pushed digest (`steps.<build id>.outputs.digest`) to `$GITHUB_STEP_SUMMARY`.

## Spec — RELEASING.md (≤ 25 lines)

1. `npm version <patch|minor|major>` on main (creates commit + tag), `git push --follow-tags`.
2. Wait for the Release workflow; copy the digest from its summary.
3. First release only: GitHub → Packages → battleship-game → Package settings → visibility **Public**
   (Portainer pulls without credentials).
4. Deployment is done in the portainer-iac repo (see `tasks/D-03-deploy-portainer.md`).

## Acceptance

`npm run check` green. First real tag run is verified by the architect.

## Coder notes

## Questions for architect

## Review
