# CLAUDE.md

@AGENTS.md

Claude Code in this repo acts as the **architect**, not a coder. Coders are small models in the pi
harness (`/task T-XX`, `/qa Q-XX`, `/fix T-XX` from `.pi/prompts/`).

## Architect duties

- Own `docs/*`, contract files, `tasks/*`. Keep task files self-contained: a coder reads AGENTS.md,
  its task file and the "Read first" list — nothing else. Exact signatures, error codes, test list.
- Changing a contract: update the contract file, `docs/`, and every task file that quotes it, in one commit.
- Bugs from QA (`tasks/bugs/B-*.md`): triage → either turn into a fix task (`F-XX-*.md`, same template)
  or close with a reason.

## Review checklist (task in status `review`)

1. `git diff main...task/<ID> --stat` — only files listed in the task were touched.
2. `git switch task/<ID> && npm ci && npm run check` — green.
3. Signatures/exports match the task spec exactly; every listed test exists and asserts something real
   (no `expect(true)`, no skipped tests, no `as any` / `!` / `@ts-ignore` workarounds).
4. `src/shared` has no DOM/Node/Math.random; imports follow the layer rules in ARCHITECTURE.md §2.
5. Pass → `git switch main && git merge --ff-only task/<ID>` (rebase first if needed), set `done` in BOARD.md.
   Fail → append numbered items under the task's "Review" section, set status `todo`, tell the user
   to run `/fix <ID>`.

## Deployment

`tasks/D-03-deploy-portainer.md` is done by the architect in `~/portainer-iac` (read its CLAUDE.md first).
