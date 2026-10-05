# Releasing

The image lives at `ghcr.io/sersol-ai/battleship-game:<X.Y.Z>` (plus `:latest`). It is built by the
**Release** workflow (`.github/workflows/release.yml`), which runs on a git tag `vX.Y.Z` and refuses
to publish if `npm run check` fails.

1. On `main`, bump the version and push the tag:

   ```bash
   npm version patch   # or minor / major — reads package.json "version", prints the new tag
   git push --follow-tags
   ```

   `npm version` rewrites `package.json` and creates the commit and the `v<version>` tag together.

2. Wait for the Release workflow to finish (Actions → "release"); copy the image **digest** it
   prints in the run summary (`sha256:…`). That digest is what the deploy pins.

3. First release only: make the package public — GitHub → Packages → `battleship-game` → Package
   settings → visibility **Public**. Portainer pulls without credentials.

4. Deployment itself happens in the `portainer-iac` repo: pin
   `image: ghcr.io/sersol-ai/battleship-game:<X.Y.Z>@sha256:<digest>` in
   `battleship/docker-compose.yml` — see `tasks/D-03-deploy-portainer.md`.
