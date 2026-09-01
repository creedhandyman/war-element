// Tiny UI-shared bits (no game rules here).

import type { Element, Keyword, PlayerId, StatusKind } from "../engine";

// Element colors — the redesign palette (brighter, reads on the cosmic board).
/** THE element order, wherever a UI lists all eight.
 *
 *  DAWN and DUSK sit at the end, in that order. They are the light-and-shadow
 *  pair — the two the campaign treats as a set and the matchup table gives
 *  their own rule to — so they read as a closing pair rather than as items 4
 *  and 7 of a list that is otherwise the six ordinary elements.
 *
 *  One list, because there were FIVE copies of it: the deck builder, the deck
 *  stats, the rules book, the collection and the squad picker each had their
 *  own, so a reorder meant finding all five or shipping screens that disagreed
 *  about where DAWN goes. */
// VOID goes LAST and on purpose: it is the Tower's element, not one of the
// eight the game is played with, and every screen that iterates this list reads
// as "the eight, and then the other thing".
export const ELEMENTS: Element[] = ["LEAF", "PYRO", "AQUA", "GALE", "BOLT", "BORE", "DAWN", "DUSK", "VOID"];

export const EL_COLOR: Record<Element, string> = {
  LEAF: "#4caf6d",
  AQUA: "#4d94e8",
  PYRO: "#e06060",
  BORE: "#a1887f",
  GALE: "#ffa040",
  BOLT: "#9575ff",
  // Was #2c1547. That reads as "the dark element" when it fills something, and
  // as nothing at all when it is a 1.5px rim on a near-black board — DUSK was
  // the one element you could not identify by its border. Mirrored in the
  // [data-el="DUSK"] rule in styles.css; change both or neither.
  DUSK: "#7b4fb0",
  DAWN: "#ffd54f",
  // The art's violet. Deliberately cooler and more saturated than BOLT's
  // lavender and DUSK's plum: all three are purples, and the board has to stay
  // readable when a VOID boss fields BOLT reinforcements beside it.
  VOID: "#b14dff",
};

// Collector rarity → badge color + short label. Undefined rarity shows nothing.
export const RARITY_STYLE: Record<string, { color: string; label: string }> = {
  // Red, and deliberately not the pink it was: pink sat next to the violet
  // epic on the wheel, so the top of the ladder read as a brighter epic. Red
  // is its own end of the scale.
  //
  // MIRRORED IN styles.css as the `--rar-*` tokens, and `styles.test.ts` fails
  // if the two drift. Change both or neither.
  mythic: { color: "#ff2e46", label: "MYTHIC" },
  legendary: { color: "#ffb02e", label: "LEGEND" },
  epic: { color: "#b06bff", label: "EPIC" },
  rare: { color: "#4db6ff", label: "RARE" },
  common: { color: "#8a8f98", label: "COMMON" },
};

// Per-element alchemical sigil — a small flourish on card faces.
export const EL_SIGIL: Record<Element, string> = {
  LEAF: "🜁",
  AQUA: "🜄",
  PYRO: "🜂",
  BORE: "🜃",
  GALE: "≋",
  BOLT: "⚡",
  DUSK: "☽",
  DAWN: "☀",
  // The one eye, which is the whole design of the element.
  VOID: "◉",
};

// Spell art lives at public/spells/<spellId>.webp (LFS-tracked, like card art).
// Not every spell has art yet, so every render site guards with an onError that
// falls back to the element-tinted placeholder.
export function spellArtSrc(spellId: string): string {
  return `/spells/${spellId}.webp`;
}

// Painted element badges (public/elements/*.png) — used for the on-card element
// mark and the card-detail chip in place of the plain glyph.
export const EL_ICON: Record<Element, string> = {
  LEAF: "/elements/leaf.png",
  AQUA: "/elements/aqua.png",
  PYRO: "/elements/pyro.png",
  BORE: "/elements/bore.png",
  GALE: "/elements/gale.png",
  BOLT: "/elements/bolt.png",
  DUSK: "/elements/dusk.png",
  DAWN: "/elements/dawn.png",
  VOID: "/elements/void.png",
};

// Per-element dark stripe pair — the card-token backdrop when art is missing.
export const EL_STRIPE: Record<Element, [string, string]> = {
  LEAF: ["#16321c", "#0e2413"],
  AQUA: ["#12294a", "#0b1c34"],
  PYRO: ["#3a1414", "#2a0e0e"],
  BORE: ["#33261f", "#241a15"],
  GALE: ["#3d2a10", "#2b1d0a"],
  BOLT: ["#241a44", "#181030"],
  DUSK: ["#2a1440", "#1c0d2e"],
  DAWN: ["#3d3210", "#2b230a"],
  VOID: ["#2b0d4a", "#160526"],
};

// Status icon language — a unique glyph + color per status (redesign spec).
export const STATUS_STYLE: Record<StatusKind, { glyph: string; color: string }> = {
  ROOT: { glyph: "🌿", color: "#4caf6d" },
  BLEED: { glyph: "🩸", color: "#d4506a" },
  BURN: { glyph: "🔥", color: "#e06060" },
  SCALD: { glyph: "♨", color: "#a8d4e8" },
  DOT: { glyph: "☠", color: "#c94b4b" },
  FREEZE: { glyph: "❄", color: "#7ec8ff" },
  STUN: { glyph: "✶", color: "#ffa040" },
  WEAKEN: { glyph: "▼", color: "#90a4ae" },
  PARALYZE: { glyph: "⚡", color: "#ffd600" },
  MUTED: { glyph: "🚫", color: "#9575ff" },
  SLEEP: { glyph: "💤", color: "#a1887f" },
  FRIGHTEN: { glyph: "💀", color: "#9c5fd4" },
  BLIND: { glyph: "👁", color: "#ffd54f" },
  SEAL: { glyph: "🚱", color: "#e0a0e0" },
  ELECTRIFIED: { glyph: "⚡", color: "#7c4dff" }, // BOLT violet — distinct from PARALYZE's yellow
  STEALTH: { glyph: "◌", color: "#8b93a8" },
  EVASION: { glyph: "〰", color: "#a8d4e8" },
};

// Keyword pip language — visual glyphs on board cards (redesign spec).
export const KEYWORD_STYLE: Record<string, { glyph: string; color: string }> = {
  FLYING: { glyph: "🪽", color: "#e0d5ff" },
  STEALTH: { glyph: "◌", color: "#8b93a8" },
  EVASION: { glyph: "〰", color: "#a8d4e8" },
  BLOCK: { glyph: "⛨", color: "#7ea6c8" },
  REFLECT: { glyph: "⧉", color: "#cfd6ea" },
  PEN: { glyph: "➤", color: "#ffa040" },
  LIFESTEAL: { glyph: "❥", color: "#d4506a" },
  DRAIN: { glyph: "🕳", color: "#c94b4b" },
  CRIT: { glyph: "★", color: "#ffd763" },
  REGEN: { glyph: "✚", color: "#7fd89a" },
  TRAMPLE: { glyph: "🐾", color: "#c9a06a" },
};

/** Every keyword, in pip order, for the filter rows.
 *
 *  Derived from an EXHAUSTIVE record rather than written as an array: a new
 *  entry on the `Keyword` union then fails to compile until it is listed here,
 *  instead of quietly never appearing as a filter. */
const ALL_KEYWORDS: Record<Keyword, true> = {
  FLYING: true, STEALTH: true, EVASION: true, BLOCK: true, REFLECT: true, PEN: true,
  LIFESTEAL: true, DRAIN: true, CRIT: true, REGEN: true, TRAMPLE: true,
};
export const KEYWORDS = Object.keys(ALL_KEYWORDS) as Keyword[];

export type Selection =
  | { kind: "hand"; handId: string }
  | { kind: "card"; instanceId: string }
  | { kind: "spell"; spellId: string; mode?: "attack" | "shield" }
  | null;

/** What the action bar is currently ARMED for, waiting on a confirming second
 *  press. "talent" is here for the same reason as the other two, and with more
 *  cause than either: a Talent is free and once per game, so a stray tap spends
 *  the card's whole one-shot with nothing to undo it. */
export type PendingBattle = "basic" | "special" | "talent" | "plummet" | null;

/** One suit per seat, in the order they are dealt.
 *
 *  Paired with the seat COLOUR rather than replacing it: two channels for one
 *  fact, so the board still reads when either is unavailable — a colour-blind
 *  player has the shape, and a player squinting at a small token has the tint.
 *
 *  Deliberately NOT coloured by the card-deck convention (hearts red, spades
 *  black): here the colour carries the SEAT and the shape carries the suit, so
 *  giving the suit its traditional colour would put two meanings on one
 *  channel and break the pairing above. */
export const SEAT_SUIT: Record<PlayerId, { glyph: string; key: string }> = {
  P1: { glyph: "♠", key: "spade" },
  P2: { glyph: "♣", key: "club" },
  P3: { glyph: "♦", key: "diamond" },
  P4: { glyph: "♥", key: "heart" },
};
