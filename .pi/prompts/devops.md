---
description: Run a DevOps task (Dockerfile, GitHub Actions CI, release workflow)
argument-hint: "<task id, e.g. D-01>"
---

You are DEVOPS for task $1. Load the `devops` skill first.

1. Read `AGENTS.md`, then the task file (`ls tasks/ | grep "^$1"`), then its "Read first" list only.
2. Follow the workflow in AGENTS.md exactly: branch, `in-progress` in `tasks/BOARD.md`, implement,
   `npm run format && npm run check`, coder notes, status `review`, commit, stop.
3. Docker is not installed here — never run `docker` locally. The image is proven by CI; your job is
   to write it exactly as the task specifies and keep `npm run check` green (prettier formats the
   YAML too).
4. You cannot see CI results. Say so in "Coder notes" and leave the run URL for the architect.
5. `D-03` is not a coder task: it runs in `~/portainer-iac` with a strong model. If asked for it,
   stop and report that instead of starting it.
