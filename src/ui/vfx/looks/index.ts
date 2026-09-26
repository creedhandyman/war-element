/** Every element's look, by element — see types.ts for the contract. */
import type { Element } from "../../../engine";
import type { ElementLook, LookVariant } from "./types";
import { AQUA_ICE } from "./aqua-ice";
import { PYRO } from "./pyro";
import { AQUA } from "./aqua";
import { BOLT } from "./bolt";
import { LEAF } from "./leaf";
import { GALE } from "./gale";
import { BORE } from "./bore";
import { DAWN } from "./dawn";
import { DUSK } from "./dusk";
import { VOID } from "./void";

export const LOOKS: Record<Element, ElementLook> = { PYRO, AQUA, BOLT, LEAF, GALE, BORE, DAWN, DUSK, VOID };
export type { ElementLook, FxTools } from "./types";

/** The look a card attacks in: its element's, unless it is one of the cards
 *  that look unlike their element (an icy AQUA card). */
export function lookFor(element: Element, variant?: LookVariant): ElementLook {
  if (variant === "ice" && element === "AQUA") return AQUA_ICE;
  return LOOKS[element] ?? LOOKS.VOID;
}
