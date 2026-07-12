// Seeded RNG — every coin flip, shuffle, and tie-break in the game flows
// through this so a match replays exactly from its seed.
// mulberry32 keyed off an advancing integer cursor stored in GameState.

import type { GameState } from "./types";

function mulberry32(a: number): number {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Returns a float in [0,1) and advances the state's RNG cursor. Mutates the draft. */
export function rand(draft: GameState): number {
  draft.rngState = (draft.rngState + 1) | 0;
  return mulberry32(draft.rngState);
}

/** 50% coin: true = heads. */
export function coin(draft: GameState): boolean {
  return rand(draft) < 0.5;
}

/**
 * Coin mechanics from the rules:
 * 50% = 1 flip; 75% = 2 flips (≥1 heads); 25% = 2 flips (both heads).
 */
export function chance(draft: GameState, pct: 25 | 50 | 75): boolean {
  if (pct === 50) return coin(draft);
  const a = coin(draft);
  const b = coin(draft);
  return pct === 75 ? a || b : a && b;
}

/** Arbitrary-percentage roll (for data-driven card riders that print odds
 *  outside the 25/50/75 coin ladder). Advances the cursor once. */
export function pctChance(draft: GameState, pct: number): boolean {
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return rand(draft) < pct / 100;
}

export function randInt(draft: GameState, maxExclusive: number): number {
  return Math.floor(rand(draft) * maxExclusive);
}

/** Fisher–Yates, in place on the draft's array. */
export function shuffle<T>(draft: GameState, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(draft, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
