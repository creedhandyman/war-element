// Tiny UI-shared bits (no game rules here).

import type { Element, StatusKind } from "../engine";

// Element colors — the redesign palette (brighter, reads on the cosmic board).
export const EL_COLOR: Record<Element, string> = {
  LEAF: "#4caf6d",
  AQUA: "#4d94e8",
  PYRO: "#e06060",
  BORE: "#a1887f",
  GALE: "#ffa040",
  BOLT: "#9575ff",
  DUSK: "#9c5fd4",
  DAWN: "#ffd54f",
};

// Collector rarity → badge color + short label. Undefined rarity shows nothing.
export const RARITY_STYLE: Record<string, { color: string; label: string }> = {
  mythic: { color: "#ff5db1", label: "MYTHIC" },
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
};

export type Selection =
  | { kind: "hand"; handId: string }
  | { kind: "card"; instanceId: string }
  | { kind: "spell"; spellId: string }
  | null;

export type PendingBattle = "basic" | "special" | null;
