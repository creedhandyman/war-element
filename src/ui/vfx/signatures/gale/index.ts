/** GALE's legendaries' signature moves, by card id (see ../types.ts). A module
 *  that has not been drawn exports null, and its card plays GALE's look. */
import type { Signature } from "../types";
import { GALEON } from "./galeon";
import { KLIPSO } from "./klipso";
import { BLUEJAY } from "./bluejay";
import { TEMPEST } from "./tempest";
import { EAGON } from "./eagon";
import { TOTEM } from "./totem";
import { KLOUD } from "./kloud";
import { DREAMCATCHER } from "./dreamcatcher";
import { GOLDSPUR } from "./goldspur";

export const GALE_LEGENDARIES: Record<string, Signature | null> = {
  gale_galeon: GALEON,
  gale_klipso: KLIPSO,
  gale_bluejay: BLUEJAY,
  gale_tempest: TEMPEST,
  gale_eagon: EAGON,
  gale_totem: TOTEM,
  gale_kloud: KLOUD,
  gale_dreamcatcher: DREAMCATCHER,
  gale_goldspur: GOLDSPUR,
};
