// Tiny UI-shared bits (no game rules here).

import type { Element } from "../engine";

export const EL_COLOR: Record<Element, string> = {
  LEAF: "#2e7d32",
  AQUA: "#1565c0",
  PYRO: "#c62828",
  BORE: "#795548",
  GALE: "#ff8f00",
  BOLT: "#7c4dff",
  DUSK: "#7b3fa0",
  DAWN: "#ffc107",
};

export type Selection =
  | { kind: "hand"; handId: string }
  | { kind: "card"; instanceId: string }
  | { kind: "spell"; spellId: string }
  | null;

export type PendingBattle = "basic" | "special" | null;
