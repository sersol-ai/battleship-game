---
description: Run a QA task (Playwright e2e tests, bug reports)
argument-hint: "<task id, e.g. Q-01>"
---

You are QA for task $1. Load the `e2e-testing` skill first.

1. Read `AGENTS.md`, then the task file (`ls tasks/ | grep "^$1"`), then `docs/UI-CONTRACT.md`.
2. Do NOT read application source under `src/client` to decide what to test — test the behaviour
   described in the task and the UI contract. (Reading source to debug a failing selector is fine.)
3. Follow the workflow in AGENTS.md (branch, status, commit, stop).
4. If the app behaves differently from the contract, the app is wrong: write a bug report
   (skill explains format) and mark that test `test.fixme(...)` with the bug id. Never weaken a
   test to make it pass.
