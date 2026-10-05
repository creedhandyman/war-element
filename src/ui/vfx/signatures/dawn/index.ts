/** DAWN's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays DAWN's look. */
import type { Signature } from "../types";
import { KOSMOS } from "./kosmos";
import { EMPYREAN } from "./empyrean";
import { REVEILLE } from "./reveille";
import { HEIR } from "./heir";
import { LEO } from "./leo";
import { AURORA } from "./aurora";
import { SUNBANNER } from "./sunbanner";
import { LASSOS } from "./lassos";
import { BAILEY } from "./bailey";

export const DAWN_LEGENDARIES: Record<string, Signature | null> = {
  dawn_kosmos: KOSMOS,
  dawn_dawn: EMPYREAN,
  dawn_aurelion: REVEILLE,
  dawn_heir_tok: HEIR,
  dawn_leo: LEO,
  dawn_aurora: AURORA,
  dawn_commander: SUNBANNER,
  dawn_lassos: LASSOS,
  dawn_riflemen: BAILEY,
};
