/** REPLAYS — a match is its first state plus the steps that moved it.
 *
 *  The engine is a pure reducer over a seeded RNG and fully serializable state:
 *  `applyIntent(state, intent)` and `advance(state)` are the only two ways a
 *  match moves, and both are functions of the state alone. So a replay is not a
 *  film of the board, it is the recipe — the opening state and the list of
 *  steps — and re-running the recipe rebuilds every frame exactly.
 *
 *  A step is either an Intent (something a person did) or an `advance` (the
 *  engine moving on by itself: an AI turn, a battle activation, Cleanup). The
 *  advances come in long runs, so a run is stored as one number: `[3, intent,
 *  12]` is three advances, the intent, twelve advances. That keeps a full match
 *  to a few kilobytes on top of its opening state.
 *
 *  `finalHash` is a fingerprint of the last state as it was RECORDED. A replay
 *  re-run on a later build (a card rebalanced, a rule fixed) can play out
 *  differently; comparing the hash at the end is how the viewer knows to say so
 *  instead of showing a different match as if it were this one.
 */
import { advance, applyIntent } from "./phases";
import type { GameState, Intent, PlayerId } from "./types";

export const REPLAY_VERSION = 1;

/** A run of `advance` calls (a number) or one Intent. */
export type ReplayStep = number | Intent;

export interface Replay {
  v: typeof REPLAY_VERSION;
  initial: GameState;
  steps: ReplayStep[];
  /** How many single steps the recipe expands to — the scrubber's length. */
  length: number;
  /** `stateHash` of the final state as recorded. */
  finalHash: string;
  /** What the match was and who sat where — carried inside the replay so a
   *  shared code shows the decks, not "You vs Opponent". */
  meta?: { title: string; names?: Partial<Record<PlayerId, string>>; me: PlayerId };
}

/** One single step, expanded. */
export type ReplayOp = Intent | "advance";

/** Append one step to a recipe, folding advances into runs. */
export function pushStep(steps: ReplayStep[], op: ReplayOp): void {
  if (op === "advance") {
    const last = steps.length - 1;
    if (last >= 0 && typeof steps[last] === "number") (steps[last] as number)++;
    else steps.push(1);
  } else steps.push(op);
}

/** How many single steps a recipe holds. */
export const stepCount = (steps: readonly ReplayStep[]): number =>
  steps.reduce<number>((n, s) => n + (typeof s === "number" ? s : 1), 0);

/** The recipe as single steps, in order. */
export function expandSteps(steps: readonly ReplayStep[]): ReplayOp[] {
  const out: ReplayOp[] = [];
  for (const s of steps) {
    if (typeof s === "number") for (let i = 0; i < s; i++) out.push("advance");
    else out.push(s);
  }
  return out;
}

/** Apply one single step. */
export const applyOp = (s: GameState, op: ReplayOp): GameState =>
  op === "advance" ? advance(s) : applyIntent(s, op);

/** A deep copy through JSON — the same round trip the state takes over the
 *  wire and into storage, so a replay starts from exactly what was saved. */
export const cloneState = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

/** FNV-1a over the state's JSON: cheap, stable for a given build, and enough to
 *  tell "the same match" from "a different one". Not a security hash. */
export function stateHash(s: GameState): string {
  const str = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Build a finished replay from a recording. */
export function makeReplay(initial: GameState, steps: ReplayStep[], final: GameState): Replay {
  return { v: REPLAY_VERSION, initial, steps, length: stepCount(steps), finalHash: stateHash(final) };
}

/** Every state of the match, frame 0 (the opening) to the end. A step that
 *  throws — a replay from an older build whose intent is no longer legal —
 *  stops the run there and reports it rather than taking the viewer down. */
export function replayFrames(r: Replay): { frames: GameState[]; brokeAt: number | null; matches: boolean } {
  const frames: GameState[] = [cloneState(r.initial)];
  let brokeAt: number | null = null;
  const ops = expandSteps(r.steps);
  for (let i = 0; i < ops.length; i++) {
    try {
      frames.push(applyOp(frames[frames.length - 1], ops[i]));
    } catch {
      brokeAt = i;
      break;
    }
  }
  const matches = brokeAt === null && stateHash(frames[frames.length - 1]) === r.finalHash;
  return { frames, brokeAt, matches };
}

// ── sharing ─────────────────────────────────────────────────────────────────

/** A replay as one pasteable line: gzip, then base64. Async because the
 *  browser's CompressionStream is. */
export async function encodeReplay(r: Replay): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(r));
  const gz = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  let bin = "";
  const u8 = new Uint8Array(gz);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return `WER1.${btoa(bin)}`;
}

/** The inverse. Null for anything that is not a replay code this build reads. */
export async function decodeReplay(code: string): Promise<Replay | null> {
  try {
    const body = code.trim().replace(/^WER1\./, "");
    const bin = atob(body);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const json = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const r = JSON.parse(json) as Replay;
    if (r?.v !== REPLAY_VERSION || !r.initial || !Array.isArray(r.steps)) return null;
    return r;
  } catch {
    return null;
  }
}
