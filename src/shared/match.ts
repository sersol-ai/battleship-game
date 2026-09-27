import type { MatchAction, MatchError, MatchState, PlayerId, Result } from "./types.ts";
import { EXTRA_SHOT_ON_HIT } from "./rules.ts";
import { createBoard, fireAt, allShipsSunk } from "./shots.ts";
import { validateFleet } from "./board.ts";

export function other(p: PlayerId): PlayerId {
  return p === "p1" ? "p2" : "p1";
}

export function createMatch(firstTurn: PlayerId): MatchState {
  return {
    phase: "placing",
    boards: { p1: null, p2: null },
    turn: firstTurn,
    winner: null,
    history: [],
  };
}

export function applyAction(
  state: MatchState,
  action: MatchAction,
): Result<MatchState, MatchError> {
  if (action.type === "place") {
    // Place checks in order
    if (state.phase !== "placing") {
      return { ok: false, error: "NOT_PLACING" };
    }
    const player = action.player;
    if (state.boards[player] !== null) {
      return { ok: false, error: "ALREADY_PLACED" };
    }
    const fleetValidation = validateFleet(action.fleet);
    if (!fleetValidation.ok) {
      return { ok: false, error: "INVALID_FLEET" };
    }
    const newBoards = { ...state.boards };
    newBoards[player] = createBoard(action.fleet);
    const phase = newBoards.p1 !== null && newBoards.p2 !== null ? "playing" : "placing";
    return {
      ok: true,
      value: {
        ...state,
        phase,
        boards: newBoards,
      },
    };
  }

  if (action.type === "fire") {
    const player = action.player;
    const coord = action.coord;
    const opponent = other(player);

    // Fire checks in order
    if (state.phase !== "playing") {
      return { ok: false, error: "NOT_PLAYING" };
    }
    if (player !== state.turn) {
      return { ok: false, error: "NOT_YOUR_TURN" };
    }

    // Fire at opponent's board
    const oppBoard = state.boards[opponent];
    if (!oppBoard) {
      return { ok: false, error: "NOT_PLAYING" };
    }

    const fireResult = fireAt(oppBoard, coord);
    if (!fireResult.ok) {
      return { ok: false, error: fireResult.error };
    }

    const newOppBoard = fireResult.value.board;
    const shotResult = fireResult.value.result;

    const newBoards = { ...state.boards };
    newBoards[opponent] = newOppBoard;

    const newHistory = [...state.history, { by: player, result: shotResult }];
    const winner: PlayerId | null = allShipsSunk(newOppBoard) ? player : null;
    const newPhase = winner ? "finished" : "playing";

    let newTurn = state.turn;
    if (!winner) {
      if (shotResult.outcome !== "miss" && EXTRA_SHOT_ON_HIT) {
        // turn unchanged (shooter fires again)
      } else {
        newTurn = opponent;
      }
    }

    return {
      ok: true,
      value: {
        ...state,
        phase: newPhase,
        boards: newBoards,
        history: newHistory,
        turn: newTurn,
        winner,
      },
    };
  }

  // Should not reach here since MatchAction is union
  return { ok: false, error: "NOT_PLAYING" as MatchError };
}
