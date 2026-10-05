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

- Wrote `.github/workflows/release.yml` exactly to the spec: `push` on `v*.*.*`, `permissions: {contents: read, packages: write}`, checkout → setup-node 22 (`cache: npm`) → `npm ci` → `npm run check` (so a broken build never publishes) → buildx → ghcr login (`github.actor` / `GITHUB_TOKEN`) → metadata (`{{version}}`, `{{major}}.{{minor}}`, `latest`) → build-push (`push: true`, `linux/amd64`, tags+labels from metadata, `cache-from: type=gha`, `cache-to: type=gha,mode=max`). Last step echoes `steps.build.outputs.digest` into `$GITHUB_STEP_SUMMARY` — that is the digest D-03 pins.
- `RELEASING.md` is 24 lines (under the 25-line cap): `npm version` + `git push --follow-tags`, read the digest off the run summary, make the package Public once, then D-03 in portainer-iac.
- Surprising bit: prettier parses the YAML, so `npm run check` really does catch it. My first draft's `run: echo "digest: …"` one-liner failed with "Nested mappings are not allowed in compact mappings" (the `: ` inside the quoted text); it is now a `run: |` block scalar.
- I cannot see CI results from here — no tag has been pushed, so no Actions run exists yet. Architect: push `v0.1.1` (or whatever `npm version patch` picks) and check the run at https://github.com/sersol-ai/battleship-game/actions/workflows/release.yml, then record the digest here.

Final `npm run check`: Test Files 21 passed (21) · Tests 199 passed (199) · prettier "All matched files use Prettier code style!" · typecheck clean.

## Questions for architect

## Review

`release.yml` and `RELEASING.md` both match spec exactly (permissions, metadata tags, build-push
config, digest-to-summary step; `RELEASING.md` is 24 lines, within the ≤25 cap and accurate).
`npm run check` confirmed green by hand (199 tests). Merging and cutting the first real release
(`npm version patch`, `git push --follow-tags`) to satisfy this task's acceptance bar.
