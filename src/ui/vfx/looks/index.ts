/** Every element's look, by element — see types.ts for the contract. */
import type { Element } from "../../../engine";
import type { ElementLook } from "./types";
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
