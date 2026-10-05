/** PYRO's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays PYRO's look. */
import type { Signature } from "../types";
import { SOL } from "./sol";
import { VOLCANON } from "./volcanon";
import { MAGMADON } from "./magmadon";
import { MAGMAW } from "./magmaw";
import { AFTERMATH } from "./aftermath";
import { DYNOMIGHT } from "./dynomight";
import { INFERNUS_REX } from "./infernusrex";
import { BURNOUT } from "./burnout";
import { WARKILN } from "./warkiln";

export const PYRO_LEGENDARIES: Record<string, Signature | null> = {
  pyro_sol: SOL,
  pyro_volcanon: VOLCANON,
  pyro_magmadon: MAGMADON,
  pyro_magmaw: MAGMAW,
  pyro_aftermath: AFTERMATH,
  pyro_dynomight: DYNOMIGHT,
  pyro_infernus_rex: INFERNUS_REX,
  pyro_burnout: BURNOUT,
  pyro_warkiln: WARKILN,
};
