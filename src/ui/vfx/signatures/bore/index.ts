/** BORE's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays BORE's look. */
import type { Signature } from "../types";
import { DUNEWRAITH } from "./dunewraith";
import { BEAROCKS } from "./bearocks";
import { PRISM } from "./prism";
import { BASTION } from "./bastion";
import { ADAMANT } from "./adamant";
import { VENOMARCH } from "./venomarch";
import { IRONCLAD } from "./ironclad";
import { KOBRA } from "./kobra";
import { SPINOSAUR } from "./spinosaur";

export const BORE_LEGENDARIES: Record<string, Signature | null> = {
  bore_sandman: DUNEWRAITH,
  bore_bearocks: BEAROCKS,
  bore_prism: PRISM,
  bore_bastion: BASTION,
  bore_diam: ADAMANT,
  bore_score: VENOMARCH,
  bore_steel: IRONCLAD,
  bore_kobra: KOBRA,
  bore_spinosaur: SPINOSAUR,
};
