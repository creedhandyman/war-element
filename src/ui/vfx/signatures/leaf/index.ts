/** LEAF's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays LEAF's look. */
import type { Signature } from "../types";
import { THORN } from "./thorn";
import { ELDERROOT } from "./elderroot";
import { FALLOW } from "./fallow";
import { SYLVANE } from "./sylvane";
import { EVERA } from "./evera";
import { NIGHTSHADE } from "./nightshade";
import { HARTWOOD } from "./hartwood";
import { SNAPMAW } from "./snapmaw";
import { GRIZZLY } from "./grizzly";

export const LEAF_LEGENDARIES: Record<string, Signature | null> = {
  leaf_thorn: THORN,
  leaf_elderroot: ELDERROOT,
  leaf_fallow: FALLOW,
  leaf_efy: SYLVANE,
  leaf_season: EVERA,
  leaf_nightshade: NIGHTSHADE,
  leaf_warden: HARTWOOD,
  leaf_snapmaw: SNAPMAW,
  leaf_grizzly: GRIZZLY,
};
