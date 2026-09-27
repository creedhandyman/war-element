/** Every mythic's signature, by card id (see types.ts). A module that has not
 *  been drawn exports null, and its card plays its element's look like any
 *  other; so does a mythic missing from this list, the bosses included. */
import type { Signature } from "./types";
import { OAKGRE } from "./oakgre";
import { TRINEZER } from "./trinezer";
import { PYROGON } from "./pyrogon";
import { KRAKEN } from "./kraken";
import { IMPERATOR } from "./imperator";
import { SKYREND } from "./skyrend";
import { ARC } from "./arc";
import { SHADOW_HORSEMEN } from "./shadow-horsemen";
import { DEEPEST } from "./deepest";
import { VELVOLT_KNIGHT } from "./velvolt-knight";
import { NITRO } from "./nitro";
import { SUPERNOVA } from "./supernova";
import { STORMFANG } from "./stormfang";
import { HYDROGON } from "./hydrogon";
import { SKULLKING } from "./skullking";
import { COREBORER } from "./coreborer";
import { EQUESTRIAN } from "./equestrian";

const ALL: Record<string, Signature | null> = {
  leaf_oakgre: OAKGRE,
  leaf_trinezer: TRINEZER,
  pyro_pyrogon: PYROGON,
  aqua_kraken: KRAKEN,
  dawn_imperator: IMPERATOR,
  gale_griffith: SKYREND,
  bolt_elecdroid: ARC,
  dusk_shadowhorsemen: SHADOW_HORSEMEN,
  bore_deepest: DEEPEST,
  bolt_velvolt_knight: VELVOLT_KNIGHT,
  pyro_nitro: NITRO,
  dawn_supernova: SUPERNOVA,
  gale_stormfang: STORMFANG,
  aqua_hydrogon: HYDROGON,
  dusk_skullking: SKULLKING,
  bore_the_coreborer: COREBORER,
  dawn_equestrian: EQUESTRIAN,
};

export const SIGNATURES: Readonly<Record<string, Signature>> = Object.fromEntries(
  Object.entries(ALL).filter((e): e is [string, Signature] => e[1] !== null),
);
