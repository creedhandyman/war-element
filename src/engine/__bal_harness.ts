// BALANCE HARNESS — headless AI-vs-AI game runner for the Domination audit.
//
// NOT a source file and NOT a test. It is scratch tooling that six audit
// agents import; it must not be staged or committed.
//
// HOW IT DRIVES THE ENGINE
// ------------------------
// The pattern is lifted verbatim from the two places the repo already plays
// whole games headlessly:
//   src/engine/__tests__/domination.test.ts:537  (`aiMatch`)
//   src/engine/__tests__/void-tower.test.ts:2301 ("the balance-harness pattern")
// Both do the same three things:
//   1. createInitialState(seed, ...) with `humans: []`, so NO seat waits for a
//      person and `advance()` drives every player's AI itself.
//   2. For Domination, stamp `state.domination = newDomination(DOMINATION_7X7)`
//      after construction — exactly what src/ui/App.tsx:1178 does. The 7x7 is
//      only a board size until that stamp; the stamp is the mode.
//   3. Loop `advance()` until `phase === "gameover"`, bailing if advance()
//      returns the same reference (the engine is idle / waiting).
//
// DETERMINISM — YES, FULLY SEEDED. See notes at the bottom of this file.
//
// SANITY NUMBERS THIS HARNESS PRODUCED — measured on commit 7a935d4
// ("feat(gale): a shove is aimed by the shover; Points are the 7x7's whole
// economy"), clean tree, 2026-08-29 16:13. engineCanary() at the time:
//   7:dP2r6s98k1d41|5:cP2r30s615k27d403|4:cP1r14s200k10d124
//
//   Domination 7x7, 2 seats, mirror pre_inferno_blitz_5, n=1000, seed stride:
//     995/1000 ended by "domination", 4 elimination, 1 timeout.
//     rounds: mean 8.30, median 7.   P2 60.2% / P1 39.8%.   69.3 ms/game.
//   3 seats, n=200: 193/200 domination, mean 11.6 rounds. P3 80.0% / P2 15.5% / P1 4.5%.
//   4 seats, n=1000: 682 domination / 315 elimination / 3 timeout, mean 18.4
//     rounds. P3 48.9% / P2 26.7% / P1 20.6% / P4 3.8%.   764 ms/game.
//
//   Mirror-deck P1 win rate by board (pre_inferno_blitz family, seed stride):
//     4x4 plain  n=500  P1 51.2%    5x5 plain  n=500  P1 53.0%
//     7x7 plain  n=300  P1 52.7%    7x7 DOM    n=300  P1 44.3%
//   i.e. the plain boards are ~even for a mirror. A prior claim of "P1 77% on
//   5x5 / 72% on 4x4" did NOT reproduce under any deck configuration tried;
//   the closest asymmetric case (the engine's own default leaf_pyro vs
//   bore_dusk starter decks) gives P1 58% on 4x4 and 59% on 5x5, n=300 each.
//
//   THE MODE IS DECK-SENSITIVE. Same map, 2 seats, n=200 each:
//     mirror pre_inferno_blitz_5 P2 54.5%   pre_frostkeep_5  P2 51.0%
//     mirror pre_radiant_host_5  P2 61.5%   pre_nightfall_5  P2 60.0%
//     flat 30x leaf_weeds, no spells:       P1 84.0%  (!)
//   So "the 7x7 favours seat N" is a statement about a DECK, not the map.

import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination, heldCount } from "../data/domination";
import { premadeDecksFor } from "../data/custom-decks";
import type { GameState, PlayerId, WinInfo } from "./types";

export const DOM_MAP = DOMINATION_7X7;
export const ALL_SEATS: PlayerId[] = ["P1", "P2", "P3", "P4"];

// ── options ─────────────────────────────────────────────────────────────────

export type EndReason = WinInfo["by"] | "round-cap" | "step-cap" | "stalled" | "error";

export interface RunGameOpts {
  /** RNG seed. The engine's `rngState` cursor IS this number; every flip,
   *  shuffle and tie-break in the match derives from it. Same seed + same
   *  inputs = byte-identical match. */
  seed: number;
  /** 7 = Domination map (default), 5 = large plain board, 4 = standard plain. */
  boardSize?: number;
  /** Force the mode. Default: "domination" iff boardSize === 7. Set
   *  "plain" with boardSize 7 to measure the SAME board without the objective. */
  mode?: "domination" | "plain";
  /** 2, 3 or 4. Only Domination seats more than two (App.tsx clamps the rest). */
  seats?: number;
  /** Per-seat deck: a premade deck id, or an explicit card-id list. Index 0 =
   *  P1. Short lists are padded by repeating the last entry (so one deck =
   *  a mirror). Default: the first premade for this board, mirrored. */
  decks?: (string | string[])[];
  /** Per-seat spellbook. `undefined` = derive from the deck's elements (the
   *  engine's own default); `[]` = no spells at all. Default: whatever the
   *  chosen premade declares, or derive. */
  spells?: (string[] | undefined)[];
  /** Stop and report `by:"round-cap"` once `state.round` exceeds this. The
   *  ENGINE's own hard cap is MAX_ROUNDS = 50 (types.ts:2547) and ends the
   *  match with `by:"timeout"`; this is an additional, earlier cap. */
  maxRounds?: number;
  /** Safety valve on advance() calls. Default 200_000. */
  maxSteps?: number;
  /** Keep the full per-round holder table (4 keys x rounds). Default true;
   *  turn off for a hot loop that only wants win rates. */
  trackPoints?: boolean;
  /** Keep the final state on the result (big — a whole GameState). Default false. */
  keepState?: boolean;
}

export interface SeatResult {
  seat: PlayerId;
  /** Sum of every gold INCOME grant this seat received, read off the engine's
   *  own per-round income log line. Excludes spend; includes the Domination
   *  Point income (POI_GOLD per held Point per round). */
  goldEarned: number;
  /** Cards played from hand onto the board. Token/spawn bodies are NOT counted
   *  (they never produce a "summons" log line). */
  cardsDeployed: number;
  /** Enemy cards this seat put down (engine's own MatchStats). */
  kills: number;
  dmg: number;
  /** Own cards lost. */
  deaths: number;
  /** Points held at the END of each completed round; index 0 = ROUND 1.
   *  Verified against the win condition: over 353 domination wins (2- and
   *  4-seat), every winner's series ends on 4 Points or carries a >=3-round
   *  run at >=3 Points. If that ever stops holding, this series is lying. */
  pointsByRound: number[];
  /** Sum of pointsByRound — "Point-rounds held". 0 outside Domination. */
  pointRounds: number;
  /** Points held when the match ended. */
  finalPoints: number;
  /** Longest run of consecutive rounds at >= DOMINATION_MAJORITY (3) Points. */
  bestStreak: number;
}

export interface GameResult {
  seed: number;
  boardSize: number;
  mode: "domination" | "plain";
  seats: PlayerId[];
  winner: PlayerId | null;
  /** How it ended. Engine reasons: domination | elimination | capture |
   *  timeout | slain | overrun | surrender. Harness reasons: round-cap |
   *  step-cap | stalled | error. */
  by: EndReason;
  /** The round the match was on when it ended. */
  rounds: number;
  /** advance() calls consumed. */
  steps: number;
  ms: number;
  /** Set iff the engine threw. `by` is then "error". */
  error?: string;
  errorStack?: string;
  seatStats: Record<string, SeatResult>;
  /** Per completed round: who held each Point at the end of it. */
  heldByRound: { round: number; held: Record<string, PlayerId | null> }[];
  state?: GameState;
}

// ── deck resolution ─────────────────────────────────────────────────────────

/** N copies of one card — the crude mirror deck the existing domination tests
 *  use (`D("leaf_weeds")`). Handy for isolating map effects from card power. */
export const flatDeck = (cardId: string, n = 30): string[] =>
  Array.from({ length: n }, () => cardId);

/** The premade shelf for a board size, in the engine's own order.
 *  boardSize >= 5 (so the 7x7) draws the 30-card LARGE builds. */
export const shelfFor = (boardSize: number) => premadeDecksFor(boardSize);

function resolveSeatDecks(opts: RunGameOpts, seatCount: number) {
  const boardSize = opts.boardSize ?? 7;
  const shelf = shelfFor(boardSize);
  const fallback = shelf[0];
  const out: { deck: string | string[]; spells: string[] | undefined }[] = [];
  for (let i = 0; i < seatCount; i++) {
    const given = opts.decks?.[Math.min(i, (opts.decks?.length ?? 1) - 1)];
    const deck = given ?? fallback.cards;
    // Spells: explicit wins; else if the caller named a premade BY ID use that
    // deck's book; else if we fell back to the shelf use the shelf deck's book.
    let spells: string[] | undefined;
    if (opts.spells && i < opts.spells.length) spells = opts.spells[i];
    else if (typeof given === "string") spells = shelf.find((d) => d.id === given)?.spells;
    else if (given === undefined) spells = fallback.spells;
    out.push({ deck, spells });
  }
  return out;
}

// ── the runner ──────────────────────────────────────────────────────────────

const INCOME_RE = /Round (\d+): summon (.+?), magic/;
const SUMMON_RE = /^(P[1-4]) summons /;

/** Play one whole AI-vs-AI match and report it. Never throws: an engine
 *  exception is caught and returned as `by:"error"` with the message. */
export function runGame(opts: RunGameOpts): GameResult {
  const t0 = Date.now();
  const boardSize = opts.boardSize ?? 7;
  const mode = opts.mode ?? (boardSize === DOM_MAP.boardSize ? "domination" : "plain");
  const seatCount = Math.max(2, Math.min(4, opts.seats ?? 2));
  const seats = ALL_SEATS.slice(0, seatCount);
  const trackPoints = opts.trackPoints !== false;
  const maxSteps = opts.maxSteps ?? 200_000;

  const seatStats: Record<string, SeatResult> = {};
  for (const p of seats) {
    seatStats[p] = {
      seat: p, goldEarned: 0, cardsDeployed: 0, kills: 0, dmg: 0, deaths: 0,
      pointsByRound: [], pointRounds: 0, finalPoints: 0, bestStreak: 0,
    };
  }
  const heldByRound: { round: number; held: Record<string, PlayerId | null> }[] = [];

  let s: GameState;
  try {
    const seatDecks = resolveSeatDecks(opts, seatCount);
    const extra = seats.slice(2).map((id, i) => ({
      id, deck: seatDecks[i + 2].deck, spells: seatDecks[i + 2].spells,
    }));
    s = createInitialState(
      opts.seed,
      seatDecks[0].deck, seatDecks[1].deck,
      [],                              // humans: [] — every seat is AI-driven
      seatDecks[0].spells, seatDecks[1].spells,
      boardSize,
      undefined,                       // opening allowance: none (ordinary ramp)
      undefined,                       // terrain: none
      undefined,                       // deck stacking: none
      extra.length ? extra : undefined,
    );
    // The stamp that makes the 7x7 a MODE and not just a big board — App.tsx:1178.
    if (mode === "domination") s.domination = newDomination(DOM_MAP);
  } catch (e) {
    return {
      seed: opts.seed, boardSize, mode, seats, winner: null, by: "error",
      rounds: 0, steps: 0, ms: Date.now() - t0,
      error: `setup: ${(e as Error).message}`, errorStack: (e as Error).stack,
      seatStats, heldByRound,
    };
  }

  let steps = 0;
  let logSeen = 0;
  let lastRound = s.round;
  let by: EndReason | null = null;
  let error: string | undefined;
  let errorStack: string | undefined;

  /** Record the end-of-round Point holders for `round`.
   *
   *  READ FROM THE POST-STEP STATE, not the pre-step one. `doCleanupPhase`
   *  (phases.ts:3271) runs `resolveDomination` and then falls straight into
   *  `startRound`, which does the `round++` (phases.ts:1400) — all inside ONE
   *  `advance()` call. So at the moment the round number changes, the NEW state
   *  already carries the holders that closing round decided, and the OLD state
   *  still carries the previous round's. Reading the old one shifts the whole
   *  series back by a round: it made a real 3-round winning streak look like a
   *  2-round one, i.e. it made the win condition look broken. */
  const closeRound = (after: GameState, round: number) => {
    // Round 0 is the mulligan/setup pseudo-round — nothing has been held yet.
    if (round < 1 || !after.domination) return;
    const held = { ...after.domination.held };
    if (trackPoints) heldByRound.push({ round, held });
    for (const p of seats) {
      const n = heldCount(held as never, p);
      seatStats[p].pointsByRound.push(n);
      seatStats[p].pointRounds += n;
    }
  };

  /** Drain the log lines added since the last drain into the counters. */
  const drainLog = (g: GameState) => {
    for (let i = logSeen; i < g.log.length; i++) {
      const line = g.log[i];
      const sm = SUMMON_RE.exec(line);
      if (sm) { const st = seatStats[sm[1]]; if (st) st.cardsDeployed++; continue; }
      const im = INCOME_RE.exec(line);
      if (im) {
        // "P1 +5 / P2 +7"  →  per-seat income for this round.
        for (const part of im[2].split("/")) {
          const g2 = /(P[1-4])\s*\+(\d+)/.exec(part);
          if (g2 && seatStats[g2[1]]) seatStats[g2[1]].goldEarned += Number(g2[2]);
        }
      }
    }
    logSeen = g.log.length;
  };

  try {
    while (s.phase !== "gameover") {
      if (steps >= maxSteps) { by = "step-cap"; break; }
      if (opts.maxRounds !== undefined && s.round > opts.maxRounds) { by = "round-cap"; break; }
      const next = advance(s);
      steps++;
      if (next === s) { by = "stalled"; break; }   // engine idle / awaiting input
      drainLog(next);
      if (next.round !== lastRound) { closeRound(next, lastRound); lastRound = next.round; }
      s = next;
    }
    if (!by) {
      // The final round closes at gameover without a round++ to trigger on.
      closeRound(s, s.round);
      by = s.win?.by ?? "stalled";
    }
  } catch (e) {
    by = "error";
    error = (e as Error).message;
    errorStack = (e as Error).stack;
  }

  drainLog(s);
  for (const p of seats) {
    const st = seatStats[p];
    const side = s.stats?.byPlayer?.[p];
    if (side) { st.kills = side.kills; st.dmg = side.dmg; st.deaths = side.deaths; }
    st.finalPoints = s.domination ? heldCount(s.domination.held as never, p) : 0;
    let run = 0;
    for (const n of st.pointsByRound) {
      run = n >= 3 ? run + 1 : 0;
      if (run > st.bestStreak) st.bestStreak = run;
    }
  }

  return {
    seed: opts.seed, boardSize, mode, seats,
    // null on: a genuine draw, or any harness-side stop (round-cap / step-cap /
    // stalled / error) that ended the match before the engine declared anyone.
    winner: s.win?.winner ?? null,
    by,
    rounds: s.round,
    steps, ms: Date.now() - t0,
    error, errorStack,
    seatStats, heldByRound,
    state: opts.keepState ? s : undefined,
  };
}

// ── batch + summary ─────────────────────────────────────────────────────────

export interface Summary {
  n: number;
  ms: number;
  msPerGame: number;
  /** Wins per seat plus "draw" (a timeout nothing could separate). */
  wins: Record<string, number>;
  winPct: Record<string, number>;
  /** How the games ended, by reason. */
  endings: Record<string, number>;
  avgRounds: number;
  medianRounds: number;
  avgSteps: number;
  errors: string[];
  /** Mean per-seat totals across the batch. */
  avg: Record<string, { gold: number; deployed: number; kills: number; pointRounds: number }>;
}

export function runBatch(n: number, optsFor: (i: number) => RunGameOpts): GameResult[] {
  const out: GameResult[] = [];
  for (let i = 0; i < n; i++) out.push(runGame(optsFor(i)));
  return out;
}

export function summarize(games: GameResult[]): Summary {
  const wins: Record<string, number> = { draw: 0 };
  const endings: Record<string, number> = {};
  const errors: string[] = [];
  const agg: Record<string, { gold: number; deployed: number; kills: number; pointRounds: number }> = {};
  let ms = 0, rounds = 0, steps = 0;
  const roundList: number[] = [];
  for (const g of games) {
    ms += g.ms; rounds += g.rounds; steps += g.steps; roundList.push(g.rounds);
    const w = g.winner ?? "draw";
    wins[w] = (wins[w] ?? 0) + 1;
    endings[g.by] = (endings[g.by] ?? 0) + 1;
    if (g.error) errors.push(`seed ${g.seed}: ${g.error}`);
    for (const p of g.seats) {
      const a = (agg[p] ??= { gold: 0, deployed: 0, kills: 0, pointRounds: 0 });
      const st = g.seatStats[p];
      a.gold += st.goldEarned; a.deployed += st.cardsDeployed;
      a.kills += st.kills; a.pointRounds += st.pointRounds;
    }
  }
  const n = games.length || 1;
  const avg: Summary["avg"] = {};
  for (const [p, a] of Object.entries(agg))
    avg[p] = { gold: a.gold / n, deployed: a.deployed / n, kills: a.kills / n, pointRounds: a.pointRounds / n };
  const winPct: Record<string, number> = {};
  for (const [k, v] of Object.entries(wins)) winPct[k] = (v / n) * 100;
  roundList.sort((a, b) => a - b);
  return {
    n: games.length, ms, msPerGame: ms / n,
    wins, winPct, endings,
    avgRounds: rounds / n,
    medianRounds: roundList[Math.floor(roundList.length / 2)] ?? 0,
    avgSteps: steps / n,
    errors, avg,
  };
}

/** One-line printable digest. */
export function fmt(s: Summary): string {
  const w = Object.entries(s.winPct)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v.toFixed(1)}%`).join("  ");
  const e = Object.entries(s.endings).map(([k, v]) => `${k}:${v}`).join(" ");
  return `n=${s.n}  ${w}  | endings ${e} | rounds avg ${s.avgRounds.toFixed(2)} med ${s.medianRounds}`
    + ` | ${s.msPerGame.toFixed(1)} ms/game`;
}

// ── determinism ─────────────────────────────────────────────────────────────
//
// THE ENGINE IS FULLY SEEDED. `createInitialState(seed, ...)` sets
// `rngState = seed | 0` (state.ts:93) and EVERY random draw in the engine goes
// through `rand(draft)` in src/engine/rng.ts, a mulberry32 keyed off that
// advancing integer cursor which lives ON the state. `Math.random` is banned in
// the engine — the only mention of it is combat.ts:4186 saying so, and a grep
// over src/engine + src/data finds no call. There is no Date.now, no
// performance.now, no ambient entropy on the play path.
//
// Consequence for callers: `runGame({seed: k, ...})` is a pure function of its
// options. Two runs with the same seed produce identical results (proven by
// `verifyDeterminism` below). A difference between two batches is therefore
// SIGNAL, not noise — provided you changed something other than the seeds.
//
// NOTE the seeds are consumed as a cursor, not hashed: seeds k and k+1 start
// the mulberry32 stream one step apart, so consecutive seeds are CORRELATED at
// the very first draw. For an independent-looking sample use a stride
// (`seed: i * 7919 + 13`) rather than `seed: i`. All the sanity numbers below
// use a stride for that reason.

// ── ⚠ THE ENGINE IS A MOVING TARGET WHILE THIS AUDIT RUNS ⚠ ────────────────
//
// A second session is editing src/engine/*.ts concurrently. On 2026-08-29 I
// watched `runGame({seed:13, boardSize:7, seats:2})` change from
// `r6/s100/P1 kills 2/dmg 45` to `r6/s98/P1 kills 1/dmg 41` between two runs
// twenty minutes apart, with NO change to this harness — `git status` showed
// src/engine/phases.ts (15:45) and src/engine/combat.ts (15:41) modified in the
// working tree. Two live examples from that diff, both balance-affecting:
//   • doResourcePhase now pays NO home-slot bonus in Domination (Points only),
//     where it used to stack. Domination gold income changed under me.
//   • pushBack was rewritten from "toward the victim's own home row" to "away
//     from the pusher", which changes every shove on the 7x7.
//
// So: numbers measured at different WALL-CLOCK TIMES are not comparable, even
// with identical seeds. Before comparing your batch to another agent's, compare
// `engineCanary()` strings. Same canary = same engine = the difference is real.
export function engineCanary(): string {
  const parts: string[] = [];
  for (const o of [
    { seed: 13, boardSize: 7, seats: 2 },
    { seed: 13, boardSize: 5, seats: 2 },
    { seed: 13, boardSize: 4, seats: 2 },
  ] as RunGameOpts[]) {
    const g = runGame({ ...o, trackPoints: false });
    parts.push(`${o.boardSize}:${g.by[0]}${g.winner ?? "-"}r${g.rounds}s${g.steps}`
      + `k${g.seatStats.P1.kills}d${g.seatStats.P1.dmg}`);
  }
  return parts.join("|");
}

/** Run the same options twice and report whether the two matches agree. */
export function verifyDeterminism(opts: RunGameOpts): { ok: boolean; detail: string } {
  const a = runGame(opts);
  const b = runGame(opts);
  const key = (g: GameResult) => JSON.stringify({
    w: g.winner, by: g.by, r: g.rounds, s: g.steps,
    seat: g.seats.map((p) => g.seatStats[p]),
    held: g.heldByRound,
  });
  const ok = key(a) === key(b);
  return { ok, detail: ok ? `identical (${a.by}, round ${a.rounds}, ${a.steps} steps)` : "DIVERGED" };
}
