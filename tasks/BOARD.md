# Task board

Statuses: `todo` → `in-progress` → `review` → `done` (or `blocked`). Coders set `in-progress`,
`review`, `blocked`. Only the architect sets `done` (after review + merge).

A task is **ready** when every dependency is `done`. Tasks in the same wave can run in parallel
(separate branches/sessions).

## Tasks

| ID   | Title                               | Role      | Depends          | Wave | Status      |
| ---- | ----------------------------------- | --------- | ---------------- | ---- | ----------- |
| T-01 | Seeded RNG                          | coder     | —                | 1    | done        |
| T-02 | Board geometry + fleet validation   | coder     | —                | 1    | done        |
| T-03 | Firing at a board                   | coder     | T-02             | 2    | done        |
| T-04 | Random valid fleet                  | coder     | T-01, T-02       | 2    | done        |
| T-05 | Match state machine                 | coder     | T-03             | 3    | done        |
| T-06 | Player views (redaction)            | coder     | T-05             | 4    | done        |
| T-07 | Computer opponent                   | coder     | T-01, T-06       | 5    | done        |
| T-08 | Client shell, params, routing, menu | coder     | —                | 1    | done        |
| T-09 | LocalController (vs AI)             | coder     | T-04, T-06, T-07 | 6    | done        |
| T-10 | Grid component                      | coder     | T-06, T-08       | 5    | review      |
| T-11 | Placement screen + vs-AI wiring     | coder     | T-08, T-09, T-10 | 7    | review      |
| T-12 | Battle screen                       | coder     | T-11             | 8    | todo        |
| T-13 | Validate client messages (guards)   | coder     | —                | 1    | review      |
| T-14 | Static file handler                 | coder     | —                | 1    | todo        |
| T-15 | RoomManager                         | coder     | T-01, T-05, T-06 | 5    | in-progress |
| T-16 | Server: HTTP + WebSocket            | coder     | T-13, T-14, T-15 | 6    | todo        |
| T-17 | WebSocket client + OnlineController | coder     | T-09             | 7    | todo        |
| T-18 | Lobby + online wiring               | coder     | T-12, T-16, T-17 | 9    | todo        |
| Q-01 | Playwright setup + vs-AI e2e        | qa        | T-12             | 9    | todo        |
| D-01 | Dockerfile + CI                     | devops    | T-16, Q-01       | 10   | todo        |
| Q-02 | Online e2e                          | qa        | T-18, Q-01       | 10   | todo        |
| D-02 | Release workflow (GHCR)             | devops    | D-01             | 11   | todo        |
| Q-03 | Robustness / mobile / abuse         | qa        | Q-02             | 11   | todo        |
| D-03 | Deploy to Portainer (portainer-iac) | architect | D-02             | 12   | todo        |

Milestones: **M1 engine** (T-01…T-07) · **M2 playable vs AI** (+T-08…T-12, Q-01) ·
**M3 online** (+T-13…T-18, Q-02) · **M4 shipped** (D-01…D-03, Q-03).

## Bugs

| ID  | Title | Severity | Found by | Status |
| --- | ----- | -------- | -------- | ------ |
