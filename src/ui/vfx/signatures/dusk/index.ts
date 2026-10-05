/** DUSK's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays DUSK's look. */
import type { Signature } from "../types";
import { SKELIDER } from "./skelider";
import { ZOMBINATION } from "./zombination";
import { NIGHTFANG } from "./nightfang";
import { RAVVEN } from "./ravven";
import { VESPER } from "./vesper";
import { HOAX } from "./hoax";
import { DESTRO } from "./destro";
import { ARANEA } from "./aranea";
import { SCARECROW } from "./scarecrow";

export const DUSK_LEGENDARIES: Record<string, Signature | null> = {
  dusk_skelider: SKELIDER,
  dusk_zombination: ZOMBINATION,
  dusk_nightfang: NIGHTFANG,
  dusk_ravven: RAVVEN,
  dusk_scar: VESPER,
  dusk_hoax: HOAX,
  dusk_destro: DESTRO,
  dusk_aranea: ARANEA,
  dusk_tatterhand: SCARECROW,
};
