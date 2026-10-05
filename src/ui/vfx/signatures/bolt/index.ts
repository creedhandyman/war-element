/** BOLT's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays BOLT's look. */
import type { Signature } from "../types";
import { VOLTOGON } from "./voltogon";
import { KEEPER } from "./keeper";
import { STORMCALLER } from "./stormcaller";
import { BLACKOUT } from "./blackout";
import { JACK_ARC } from "./jackarc";
import { VOLTEDGE } from "./voltedge";
import { GIGAVOLT } from "./gigavolt";
import { HAVOC } from "./havoc";
import { KINGPIN } from "./kingpin";

export const BOLT_LEGENDARIES: Record<string, Signature | null> = {
  bolt_voltogon: VOLTOGON,
  bolt_keeper: KEEPER,
  bolt_stormcaller: STORMCALLER,
  bolt_shock: BLACKOUT,
  bolt_jack_arc: JACK_ARC,
  bolt_zoez: VOLTEDGE,
  bolt_gigavolt: GIGAVOLT,
  bolt_havoc: HAVOC,
  bolt_kingpin: KINGPIN,
};
