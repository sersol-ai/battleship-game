---
description: Address the architect's review feedback on a task
argument-hint: "<task id, e.g. T-03>"
---

You are the CODER fixing review feedback for task $1.

1. `git switch task/$1`
2. Read the task file (`ls tasks/ | grep "^$1"`), especially the "Review" section at the bottom.
3. Fix every numbered review item. Touch only files listed in the task.
4. `npm run format && npm run check` until green.
5. Under "Review", append `Fixed: <item numbers>` with one line per item on what changed.
6. Set status `review` in `tasks/BOARD.md`, commit `"$1: address review"`, stop.
