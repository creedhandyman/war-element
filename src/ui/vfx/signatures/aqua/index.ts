/** AQUA's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays AQUA's look. */
import type { Signature } from "../types";
import { PHROST } from "./phrost";
import { POLAR_KING } from "./polarking";
import { MAGALOGOON } from "./magalogoon";
import { GLACIUS } from "./glacius";
import { SIREN } from "./siren";
import { CLOUDBURST } from "./cloudburst";
import { DRIFTWRAITH } from "./driftwraith";
import { KILLER_WHALE } from "./killerwhale";
import { BLUE_WHALE } from "./bluewhale";

export const AQUA_LEGENDARIES: Record<string, Signature | null> = {
  aqua_phrost: PHROST,
  aqua_polarking: POLAR_KING,
  aqua_magalogoon: MAGALOGOON,
  aqua_glacius: GLACIUS,
  aqua_siren: SIREN,
  aqua_rain: CLOUDBURST,
  aqua_driftwraith: DRIFTWRAITH,
  aqua_killerwhale: KILLER_WHALE,
  aqua_bluewhale: BLUE_WHALE,
};
