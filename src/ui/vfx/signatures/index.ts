/** Every mythic's signature, and the legendaries' an element at a time, by card
 *  id (see types.ts). A module that has not been drawn exports null, and its
 *  card plays its element's look like any other; so does a card missing from
 *  this list. */
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
import { ROTROOT } from "./boss-rotroot";
import { SKELEEZE } from "./boss-skeleeze";
import { XILTY } from "./boss-xilty";
import { PERMAFROST } from "./boss-permafrost";
import { OVERCLOCK } from "./boss-overclock";
import { NIGHTSHRIKE } from "./boss-nightshrike";
import { BASILISK } from "./boss-basilisk";
import { HELION } from "./boss-helion";
import { HOARFELL } from "./boss-hoarfell";
import { VULCANYX } from "./boss-vulcanyx";
import { THUNDERFANGS } from "./boss-thunderfangs";
import { UMBRANOVA } from "./boss-umbranova";
import { CRYOVEX } from "./boss-cryovex";
import { KAZEHAYA } from "./boss-kazehaya";
import { SPINDLE } from "./boss-spindle";
import { KHEIRINGER } from "./boss-kheiringer";
import { SKYBREAKER } from "./boss-skybreaker";
import { CONTINENTAL } from "./boss-continental";
import { KATO } from "./boss-kato";
import { KATO_PROWLFORM } from "./boss-kato-prowlform";
import { KATO_STORMWING } from "./boss-kato-stormwing";
import { SMOLDER } from "./boss-smolder";
import { LEAF_LEGENDARIES } from "./leaf";

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
  // THE BOSSES — mythic too, and the fights they end.
  boss_rotroot: ROTROOT,
  boss_skeleeze: SKELEEZE,
  boss_xilty: XILTY,
  boss_permafrost: PERMAFROST,
  boss_overclock: OVERCLOCK,
  boss_nightshrike: NIGHTSHRIKE,
  boss_basilisk: BASILISK,
  boss_helion: HELION,
  boss_hoarfell: HOARFELL,
  boss_vulcanyx: VULCANYX,
  boss_thunderfangs: THUNDERFANGS,
  boss_thunderfangs_2: THUNDERFANGS, // Stormform: the same run, harder
  boss_umbranova: UMBRANOVA,
  boss_cryovex: CRYOVEX,
  boss_kazehaya: KAZEHAYA,
  boss_spindle: SPINDLE,
  boss_kheiringer: KHEIRINGER,
  boss_skybreaker: SKYBREAKER,
  boss_continental: CONTINENTAL,
  boss_kato: KATO,
  boss_kato_2: KATO_PROWLFORM,
  boss_kato_3: KATO_STORMWING,
  boss_smolder: SMOLDER,
  // THE LEGENDARIES, an element at a time: their Specials only (spell-fx
  // `signatureOf`).
  ...LEAF_LEGENDARIES,
};

export const SIGNATURES: Readonly<Record<string, Signature>> = Object.fromEntries(
  Object.entries(ALL).filter((e): e is [string, Signature] => e[1] !== null),
);
