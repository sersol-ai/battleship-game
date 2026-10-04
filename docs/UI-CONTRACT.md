# UI contract (data-testid)

Coders MUST add these attributes exactly. QA tests select ONLY by these attributes.
Text, classes and layout may change freely; these may not (architect approval needed).

## Screens (root element of each screen)

| testid             | element             |
| ------------------ | ------------------- |
| `screen-menu`      | menu screen root    |
| `screen-lobby`     | online lobby root   |
| `screen-placement` | ship placement root |
| `screen-battle`    | battle root         |

## Menu

| testid              | element / behaviour                                                        |
| ------------------- | -------------------------------------------------------------------------- |
| `select-difficulty` | `<select>` with options `value="easy"` / `value="normal"` (default normal) |
| `btn-play-ai`       | start a game vs computer → placement screen                                |
| `btn-play-online`   | → lobby screen                                                             |

## Grid (ui/grid.ts) — used on placement and battle screens

| testid / attribute | meaning                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `grid-placement`   | grid root on placement screen                                                    |
| `grid-own`         | grid root: my board on battle screen                                             |
| `grid-enemy`       | grid root: enemy board on battle screen (clickable when my turn)                 |
| `cell`             | every cell; a `<button>`                                                         |
| `data-x`, `data-y` | on every cell, integers 0..9                                                     |
| `data-state`       | on every cell, a `CellView` value (`unknown`/`empty`/`ship`/`miss`/`hit`/`sunk`) |
| `data-preview`     | placement hover preview: `"ok"` or `"bad"`, absent otherwise                     |

A cell is found with: `[data-testid=grid-enemy] [data-testid=cell][data-x="3"][data-y="5"]`.

## Placement screen

| testid              | element / behaviour                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ship-<type>`       | one per ShipType, e.g. `ship-carrier`; attr `data-placed="true"` when placed, absent otherwise; attr `data-selected="true"` when selected, absent otherwise; click selects it |
| `btn-rotate`        | toggles orientation H/V (keyboard `R` does the same); attr `data-orientation="H                                                                                               | V"` |
| `btn-random`        | replaces current layout with a random valid fleet                                                                                                                             |
| `btn-reset`         | removes all placed ships                                                                                                                                                      |
| `btn-ready`         | `disabled` until all ships placed; click → `controller.place(fleet)`                                                                                                          |
| `placement-error`   | visible text when the last click was an invalid spot; empty otherwise                                                                                                         |
| `placement-waiting` | visible after Ready while waiting for opponent                                                                                                                                |

Clicking a placed ship on the grid picks it up again (it becomes selected and unplaced).

## Battle screen

| testid              | element / behaviour                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turn-indicator`    | attr `data-turn="me                                                                                                                                            | enemy  | none"`; text "Your turn" / "Opponent's turn" |
| `enemy-remaining`   | list of enemy ships left; attr `data-count="<n>"`                                                                                                              |
| `my-remaining`      | list of my ships left; attr `data-count="<n>"`                                                                                                                 |
| `last-shot`         | text describing the most recent shot (e.g. "Enemy: B7 miss")                                                                                                   |
| `status-opponent`   | online only: attr `data-status` = OpponentStatus                                                                                                               |
| `status-connection` | online only: attr `data-status` = ConnectionState                                                                                                              |
| `game-over`         | shown when phase finished; attr `data-result="win                                                                                                              | lose"` |
| `btn-rematch`       | inside game-over; → `controller.rematch()`                                                                                                                     |
| `btn-menu`          | inside game-over, and in the placement/battle header; → back to menu. Only ONE `btn-menu` is visible at any time (header copy hidden while game-over is shown) |

## Lobby screen

| testid            | element / behaviour                                          |
| ----------------- | ------------------------------------------------------------ |
| `btn-create-room` | sends `create`                                               |
| `input-room-code` | text input, 6 chars, auto-uppercased                         |
| `btn-join-room`   | sends `join` with input value                                |
| `room-code`       | shows own room code after create                             |
| `room-link`       | full share URL `<origin>/?room=<CODE>`; a `<input readonly>` |
| `btn-copy-link`   | copies the link                                              |
| `lobby-error`     | error text (e.g. room not found); empty otherwise            |
| `btn-back`        | back to menu                                                 |

Opening `/?room=CODE` goes straight to the lobby and auto-joins that room.

## Human-readable coordinates

Columns `A`–`J` (x 0..9), rows `1`–`10` (y 0..9). `{x:1,y:6}` → `"B7"`.
