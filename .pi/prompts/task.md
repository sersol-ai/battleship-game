---
description: Implement one task from tasks/ as the coder
argument-hint: "<task id, e.g. T-03>"
---

You are the CODER for task $1.

1. Read `AGENTS.md` (rules + workflow) if it is not already in your context.
2. Read the task file: `ls tasks/ | grep "^$1"` then read that file completely.
3. Read ONLY the files in its "Read first" section.
4. Follow the "Workflow per task" in AGENTS.md exactly: branch, status in-progress, implement,
   `npm run format && npm run check`, coder notes, status review, commit, stop.

Implement exactly the spec: exported names, signatures and error codes must match character for
character — other tasks depend on them. Write every test listed under "Tests"; you may add more.
If something is ambiguous, pick the simplest reading and record it in "Coder notes".
