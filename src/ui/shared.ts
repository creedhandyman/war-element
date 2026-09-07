// Tiny UI-shared bits (no game rules here).

import { buildableCards } from "../data/custom-decks";
import type { Element, Keyword, PlayerId, StatusKind, Suit } from "../engine";
import { styleOf } from "../engine/suits";

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

/** The elements you can actually BUILD a deck out of — the eight, today.
 *
 *  VOID is the Tower's element and nothing in it is draftable: it is one boss
 *  and six of its brood, so every VOID def is a token or `boss: true`, and both
 *  are outside `buildableCards()` by construction. That left the deck builder
 *  with a ninth filter chip that could only ever return an EMPTY grid — a
 *  control that looks like content you have not unlocked and is in fact a
 *  control with nothing behind it.
 *
 *  The gallery keeps all nine, which is its whole job: it is the screen that
 *  exists so finished art has somewhere to be looked at, bosses and tokens
 *  included. This list is only for the grids you DEPLOY from.
 *
 *  DERIVED rather than a second hand-written list, so it cannot drift: the day
 *  VOID gets a real draftable card the chip comes back on its own, and the day
 *  an element loses its last one it goes away on its own. That is the same
 *  mistake this file's own header describes — five copies of the element order
 *  that disagreed — and a hardcoded "the eight" here would have been the sixth. */
export const BUILDABLE_ELEMENTS: Element[] =
  ELEMENTS.filter((el) => buildableCards().some((c) => c.element === el));

/** THE TEACHER, and there is only one of her.
 *
 *  `STARTER_DECK` is a single id and it is Sakuroot's, so on a brand-new save
 *  this is a portrait of the only card the player owns. Both tutorials use it —
 *  the first-run walkthrough on the menus (`GuideOverlay`) and the in-fight
 *  coach (`TutorialCoach`) — because they are one voice teaching one game, and
 *  a player who meets a face on the menus and a nameless blue box in the battle
 *  has met two tutorials.
 *
 *  A SEPARATE ASSET from `cards/leaf_sakuroot.webp`: the card art in a fight is
 *  not changing, and a portrait cropped to read at 46px is the wrong picture for
 *  a card face anyway. */
export const TEACHER_ART = "/teacher-sakuroot.webp";
export const TEACHER_NAME = "Sakuroot";

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
  // VOID IS THE BLACK ELEMENT, and the RIM is the one part of it that cannot be
  // black. This is DUSK's lesson applied before it costs anything: the note
  // above records that #2c1547 "reads as the dark element when it fills
  // something, and as nothing at all when it is a 1.5px rim on a near-black
  // board" -- the board is #040406, so a black border is not a dark border, it
  // is an absent one.
  //
  // So black goes where black is legible (the stripes below, which FILL) and
  // the rim is a cold pale silver -- the edge of a black card rather than a
  // colour of its own. It is also the only unsaturated rim in the set, which
  // solves the other half of the old note: VOID no longer has to compete with
  // BOLT's lavender and DUSK's plum for which purple it is.
  VOID: "#c2c8d8",
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
  // Actually black, not a very dark purple. This is the half of the element
  // that fills, so it is where "black" is a thing you can see.
  VOID: ["#0a0a0d", "#000000"],
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
/** The suit a seat is showing THIS MATCH, with its playstyle.
 *
 *  Suits are dealt per game now (`GameState.seatSuits`) and carry the AI's
 *  personality, so the glyph is a tell rather than a label: the same seat is
 *  not the same suit twice running. Reads the deal when there is one and falls
 *  back to the traditional seating below, which is what a state built before
 *  the deal existed still has. */
export function suitFor(seatSuits: Partial<Record<PlayerId, Suit>> | undefined, seat: PlayerId) {
  const style = styleOf(seatSuits, seat);
  return { glyph: style.glyph, key: style.key, name: style.name, blurb: style.blurb };
}

export const SEAT_SUIT: Record<PlayerId, { glyph: string; key: string }> = {
  P1: { glyph: "♠", key: "spade" },
  P2: { glyph: "♣", key: "club" },
  P3: { glyph: "♦", key: "diamond" },
  P4: { glyph: "♥", key: "heart" },
};
