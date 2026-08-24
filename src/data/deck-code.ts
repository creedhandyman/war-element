/** Deck codes — a saved deck as a short string you can paste to somebody else.
 *
 *  Format: `WE1-<base64url>`. The payload is
 *
 *      [0]      version (2)
 *      [1]      board size (4 or 5; 0 = the deck does not say)   <- v2 only
 *      [2]      name length in bytes
 *      [3..]    name, UTF-8
 *      [n]      card count
 *      [n+1]    spell count
 *      [n+2..]  (cards + spells) x 10 bits, packed, card indices first
 *      [last]   checksum (FNV-1a, 8-bit) over everything before it
 *
 *  V1 CODES STILL DECODE. They are identical but for the missing board byte, and
 *  people copied them the day the feature shipped — a format change that silently
 *  broke codes already in circulation would defeat the point of having them.
 *
 *  A 30-card, 8-spell deck lands around 70 characters.
 *
 *  ── WHY THERE IS A REGISTRY ───────────────────────────────────────────────
 *  The tempting implementation is to index into CARDS. Do not: the arrays are
 *  edited constantly, and inserting one card shifts every index after it — so an
 *  old code would still decode, without error, into a DIFFERENT deck. Silently
 *  handing somebody the wrong list is far worse than refusing the code.
 *
 *  So indices point into CODE_IDS below, which is APPEND-ONLY. New cards go on
 *  the end and every code ever shared keeps working. `deck-code.test.ts` fails if
 *  a live id is missing from it, if an entry is duplicated, or if the seeded
 *  prefix is reordered.
 *
 *  Spells are prefixed `spell:` because two ids — bolt_zap and gale_tempest —
 *  are each BOTH a card and a spell, so a bare id could not tell them apart.
 */

/** The 10-bit index space. Exceeding this needs a format version, not an edit. */
export const CODE_INDEX_CEILING = 1024;

/** APPEND ONLY. Never reorder, never delete — see the note above. */
export const CODE_IDS: readonly string[] = [
  "aqua_anglerfish", "aqua_anos", "aqua_arctik", "aqua_bahari",
  "aqua_blackbeard", "aqua_blackice", "aqua_blub", "aqua_bootlegger",
  "aqua_buccaneers", "aqua_bulletshrimp", "aqua_coralgolem", "aqua_cryo",
  "aqua_driftwraith", "aqua_glacius", "aqua_harp", "aqua_hydrogon",
  "aqua_icewall", "aqua_icynin", "aqua_icyninza", "aqua_kinguin",
  "aqua_kraken", "aqua_krakler", "aqua_liquark", "aqua_magalogoon",
  "aqua_misty", "aqua_octoirate", "aqua_owlette", "aqua_phrost",
  "aqua_piranha", "aqua_polarbear", "aqua_polarking", "aqua_rain",
  "aqua_sapphire", "aqua_siphon", "aqua_siren", "aqua_spinefin",
  "aqua_subcool", "aqua_tide", "aqua_vaporem", "bolt_buzz",
  "bolt_buzzard", "bolt_drshock", "bolt_elecdroid", "bolt_electricel",
  "bolt_general", "bolt_gigavolt", "bolt_jack_arc", "bolt_jellyfish",
  "bolt_jolt", "bolt_junker", "bolt_keeper", "bolt_kore",
  "bolt_lytning", "bolt_ning", "bolt_rodd", "bolt_scrapper",
  "bolt_sentry", "bolt_shock", "bolt_shoksa", "bolt_static",
  "bolt_staticcloud", "bolt_stingray", "bolt_storm", "bolt_stormcaller",
  "bolt_striik", "bolt_surge", "bolt_thunder", "bolt_thundercat",
  "bolt_twotales", "bolt_velvolt_knight", "bolt_volta", "bolt_voltcher",
  "bolt_voltogon", "bolt_webster", "bolt_zagphu", "bolt_zap",
  "bolt_zipp", "bolt_zoez", "bore_ankylosaur", "bore_armadillo",
  "bore_bastion", "bore_bearocks", "bore_bolder", "bore_cavedweller",
  "bore_clubber", "bore_cosmic", "bore_crock", "bore_deepest",
  "bore_diam", "bore_gemaga", "bore_hillbilly", "bore_iron",
  "bore_kcor", "bore_krysteel", "bore_lithara", "bore_monger",
  "bore_obsidi", "bore_old_timer", "bore_prism", "bore_rhe",
  "bore_rock", "bore_rockgoblin", "bore_rohojohn", "bore_rollo",
  "bore_sandman", "bore_score", "bore_sheish", "bore_shift",
  "bore_sling", "bore_smith", "bore_steel", "bore_stone",
  "bore_the_coreborer", "bore_thorny_ripper", "bore_ufo", "bore_valcana",
  "bore_warthog", "dawn_able", "dawn_amble", "dawn_ariel",
  "dawn_aurelion", "dawn_aurora", "dawn_beam", "dawn_clipsey",
  "dawn_commander", "dawn_dawn", "dawn_drakonbane", "dawn_equestrian",
  "dawn_flash", "dawn_glime", "dawn_golde", "dawn_goldeneagle",
  "dawn_halo", "dawn_heir_tok", "dawn_imperator", "dawn_kosmos",
  "dawn_lazor", "dawn_leo", "dawn_musk_ox", "dawn_oxin",
  "dawn_radiance", "dawn_raya", "dawn_reflection", "dawn_roy",
  "dawn_shine", "dawn_sircrest", "dawn_solara", "dawn_solstice",
  "dawn_sparkle", "dawn_sphere", "dawn_star", "dawn_stbern",
  "dawn_supernova", "dawn_ty", "dawn_veil", "dawn_warphant",
  "dusk_brute", "dusk_crow", "dusk_destro", "dusk_doom",
  "dusk_ender", "dusk_ghastly", "dusk_gool", "dusk_gravekeeper",
  "dusk_harve", "dusk_haunt", "dusk_hix", "dusk_hoax",
  "dusk_jackl", "dusk_nightfang", "dusk_plaguecrow", "dusk_pumpkin",
  "dusk_ravven", "dusk_reaper", "dusk_rip", "dusk_sarachnid",
  "dusk_scar", "dusk_scarlett", "dusk_shadowhorsemen", "dusk_silkstalker",
  "dusk_skeleton_knight", "dusk_skelider", "dusk_skrow", "dusk_skulldrake",
  "dusk_skullking", "dusk_soul_wisp", "dusk_spectra", "dusk_spider",
  "dusk_vamp", "dusk_violet", "dusk_wedded_wraith", "dusk_widowbite",
  "dusk_zhunk", "dusk_zombie_husk", "dusk_zombination", "gale_angale",
  "gale_bluejay", "gale_breeze", "gale_buf", "gale_duster",
  "gale_eagon", "gale_fano", "gale_galeon", "gale_gastly",
  "gale_griffith", "gale_guan", "gale_hawk", "gale_hawko",
  "gale_klipso", "gale_kloud", "gale_klouy", "gale_luna",
  "gale_masala", "gale_megair", "gale_omega", "gale_rayfen",
  "gale_sirocco", "gale_skyforce", "gale_stormfang", "gale_stormhide_bison",
  "gale_sway", "gale_swillow", "gale_syt_bird", "gale_tempest",
  "gale_totem", "gale_toxhawk", "gale_tumbleweed", "gale_vaga",
  "gale_vvulture", "gale_wailverine", "gale_whirlwolf", "gale_windsor",
  "gale_wista", "gale_wolfbane", "leaf_alpha", "leaf_bark_bushmen",
  "leaf_birch", "leaf_cactus", "leaf_citra", "leaf_dande",
  "leaf_dartfrog", "leaf_darth", "leaf_efy", "leaf_elderroot",
  "leaf_fallona", "leaf_fallow", "leaf_gecko", "leaf_greegon",
  "leaf_guardian", "leaf_hunter", "leaf_leaf", "leaf_lumberjack",
  "leaf_nettle", "leaf_nightshade", "leaf_oak", "leaf_oakgre",
  "leaf_python", "leaf_rubyo", "leaf_sakuroot", "leaf_season",
  "leaf_splint", "leaf_sprinu", "leaf_squanch", "leaf_stickers",
  "leaf_sticks", "leaf_stickviper", "leaf_sumerose", "leaf_thorn",
  "leaf_trinezer", "leaf_walking_tree", "leaf_warden", "leaf_weeds",
  "leaf_whintey", "pyro_aftermath", "pyro_ash_boar", "pyro_baboom",
  "pyro_bbq", "pyro_canister", "pyro_dyna", "pyro_dynomight",
  "pyro_ember_scorpion", "pyro_fenix", "pyro_fenrir", "pyro_firebird",
  "pyro_firecrack", "pyro_firefly", "pyro_flamehound", "pyro_florence",
  "pyro_heatsink_golem", "pyro_infernus_rex", "pyro_ingit", "pyro_liza",
  "pyro_magmadon", "pyro_magmaw", "pyro_nitro", "pyro_pyrogon",
  "pyro_sarra", "pyro_scorch", "pyro_scully", "pyro_slag_tortoise",
  "pyro_smog_card", "pyro_sol", "pyro_sparky", "pyro_spitfire",
  "pyro_sseerr", "pyro_staph", "pyro_taper", "pyro_tiki",
  "pyro_twins", "pyro_volcanon", "pyro_wick", "pyro_woof",
  "spell:aqua_chill", "spell:aqua_dense_fog", "spell:aqua_downpour", "spell:aqua_frost_patch",
  "spell:aqua_glacial_wave", "spell:aqua_ice_wall", "spell:aqua_maelstrom", "spell:aqua_pressure_crush",
  "spell:aqua_steam_vent", "spell:aqua_tsunami", "spell:bolt_full_reroute", "spell:bolt_lightning_storm",
  "spell:bolt_overload_field", "spell:bolt_power_grid", "spell:bolt_power_rebate", "spell:bolt_recon_ping",
  "spell:bolt_rewire", "spell:bolt_system_override", "spell:bolt_total_network_control", "spell:bolt_zap",
  "spell:bore_bedrock", "spell:bore_bulwark", "spell:bore_fortify", "spell:bore_landslide",
  "spell:bore_mountains_fall", "spell:bore_pebble_toss", "spell:bore_sand_trap", "spell:bore_shatterpoint",
  "spell:bore_stone_wall", "spell:bore_tremor", "spell:dawn_blazing_sun", "spell:dawn_cleansing_light",
  "spell:dawn_dawns_grace", "spell:dawn_dawns_judgment", "spell:dawn_eternal_dawn", "spell:dawn_grace",
  "spell:dawn_judgment", "spell:dawn_radiant_barrier", "spell:dawn_solar_flare", "spell:dawn_sunbeam",
  "spell:dusk_bone_snare", "spell:dusk_chill_touch", "spell:dusk_endless_night", "spell:dusk_grave_pit",
  "spell:dusk_harvest", "spell:dusk_nightfall", "spell:dusk_phantom_spikes", "spell:dusk_shadow_step",
  "spell:dusk_veil_of_shadows", "spell:dusk_wake_of_the_dead", "spell:gale_cyclone", "spell:gale_downdraft",
  "spell:gale_gale_force", "spell:gale_gust", "spell:gale_jetstream", "spell:gale_squall_line",
  "spell:gale_storm_front", "spell:gale_tailwind", "spell:gale_tempest", "spell:gale_vortex_strike",
  "spell:leaf_bloodroot_surge", "spell:leaf_bramble_wall", "spell:leaf_groves_blessing", "spell:leaf_heart_of_the_forest",
  "spell:leaf_lushfield", "spell:leaf_overgrowth", "spell:leaf_snare", "spell:leaf_sprout",
  "spell:leaf_thorn_patch", "spell:leaf_withering_grasp", "spell:pyro_ashfall", "spell:pyro_cataclysm",
  "spell:pyro_ember_trap", "spell:pyro_firewall", "spell:pyro_flare_push", "spell:pyro_heatwave",
  "spell:pyro_inferno_pit", "spell:pyro_meltdown", "spell:pyro_spark", "spell:pyro_volcanic_eruption",
  // The eight legends — appended, never inserted.
  "bolt_havoc", "leaf_snapmaw", "gale_dreamcatcher", "aqua_killerwhale", "dawn_lassos", "bore_kobra", "pyro_burnout", "dusk_aranea",

  // Void Tower bosses. APPENDED like everything else — the registry is
  // append-only, and every id must have an index so codes stay total. A boss
  // id inside a shared deck code decodes fine and then fails deck validation
  // (isBuildable refuses bosses), which is the right place for that refusal.
  "boss_rotroot", "boss_skeleeze", "boss_xilty", "boss_permafrost",
  "boss_overclock", "boss_nightshrike", "boss_basilisk",
  // Void Tower bosses — appended, never inserted: the code is an INDEX into
  // this list, so putting a name anywhere but the end re-points every saved
  // deck after it.
  "boss_helion", "boss_hoarfell", "boss_thunderfangs", "boss_umbranova",
  "boss_smolder", "boss_vulcanyx", "boss_thunderfangs_2",
  "boss_cryovex",
];

const INDEX_OF = new Map<string, number>(CODE_IDS.map((id, i) => [id, i]));

export const SPELL_KEY_PREFIX = "spell:";
const CODE_PREFIX = "WE1-";

export interface DeckCodePayload {
  name: string;
  cards: string[];
  spells: string[];
  /** Battlefield the deck was built for (4 or 5), so an import can set the right
   *  limits instead of reading as over-size. Absent on v1 codes, which predate
   *  the field — treat undefined as "the deck does not say". */
  boardSize?: number;
}

/** Thrown for every rejection, so callers can show the reason verbatim. */
export class DeckCodeError extends Error {}

function fnv1a8(bytes: number[]): number {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h ^ (h >>> 16) ^ (h >>> 24)) & 0xff;
}

function toBase64Url(bytes: number[]): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): number[] {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Array.from(bin, (c) => c.charCodeAt(0));
}

/** Pack 10-bit values, most-significant bit first. */
function pack10(values: number[]): number[] {
  const out: number[] = [];
  let acc = 0, bits = 0;
  for (const v of values) {
    acc = (acc << 10) | (v & 0x3ff);
    bits += 10;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  if (bits > 0) out.push((acc << (8 - bits)) & 0xff);
  return out;
}

function unpack10(bytes: number[], count: number): number[] {
  const out: number[] = [];
  let acc = 0, bits = 0, i = 0;
  while (out.length < count) {
    if (bits < 10) {
      if (i >= bytes.length) throw new DeckCodeError("This code is cut short.");
      acc = (acc << 8) | bytes[i++];
      bits += 8;
      continue;
    }
    bits -= 10;
    out.push((acc >> bits) & 0x3ff);
  }
  return out;
}

/** Encode a deck. Throws if it holds anything this build cannot name. */
export function encodeDeck(deck: DeckCodePayload): string {
  const name = (deck.name ?? "").trim().slice(0, 40);
  const nameBytes = Array.from(new TextEncoder().encode(name));
  if (deck.cards.length > 255 || deck.spells.length > 255)
    throw new DeckCodeError("That deck is too large to encode.");

  const idx = (key: string) => {
    const i = INDEX_OF.get(key);
    if (i === undefined)
      throw new DeckCodeError(
        `"${key}" is not in this build's deck-code registry — it needs appending to CODE_IDS.`,
      );
    return i;
  };

  const board = deck.boardSize === 4 || deck.boardSize === 5 ? deck.boardSize : 0;
  const body = [
    2,
    board,
    nameBytes.length,
    ...nameBytes,
    deck.cards.length,
    deck.spells.length,
    ...pack10([
      ...deck.cards.map((c) => idx(c)),
      ...deck.spells.map((s) => idx(SPELL_KEY_PREFIX + s)),
    ]),
  ];
  return CODE_PREFIX + toBase64Url([...body, fnv1a8(body)]);
}

/** Decode a deck code. Throws DeckCodeError with a readable reason. */
export function decodeDeck(raw: string): DeckCodePayload {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) throw new DeckCodeError("Paste a deck code first.");
  // Tolerate a pasted code that lost its prefix, and stray whitespace from chat
  // apps wrapping the line.
  const body = (trimmed.startsWith(CODE_PREFIX) ? trimmed.slice(CODE_PREFIX.length) : trimmed)
    .replace(/\s+/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new DeckCodeError("That does not look like a deck code.");

  let bytes: number[];
  try {
    bytes = fromBase64Url(body);
  } catch {
    throw new DeckCodeError("That code is damaged — check it copied whole.");
  }
  if (bytes.length < 5) throw new DeckCodeError("That code is too short to be a deck.");

  const payload = bytes.slice(0, -1);
  if (fnv1a8(payload) !== bytes[bytes.length - 1])
    throw new DeckCodeError("That code is damaged — a character is wrong or missing.");

  const version = payload[0];
  if (version !== 1 && version !== 2)
    throw new DeckCodeError(`This build cannot read version ${version} codes — update the game.`);
  // v1 has no board byte; everything after it is laid out identically.
  const boardByte = version >= 2 ? payload[1] : 0;
  let p = version >= 2 ? 2 : 1;
  const nameLen = payload[p++];
  const name = new TextDecoder().decode(Uint8Array.from(payload.slice(p, p + nameLen)));
  p += nameLen;
  if (p + 2 > payload.length) throw new DeckCodeError("That code is cut short.");
  const cardCount = payload[p++];
  const spellCount = payload[p++];

  const values = unpack10(payload.slice(p), cardCount + spellCount);
  const resolve = (i: number, wantSpell: boolean): string => {
    const key = CODE_IDS[i];
    if (key === undefined)
      throw new DeckCodeError("That code names a card this version does not have — update the game.");
    const isSpell = key.startsWith(SPELL_KEY_PREFIX);
    if (isSpell !== wantSpell) throw new DeckCodeError("That code is damaged — its contents do not line up.");
    return isSpell ? key.slice(SPELL_KEY_PREFIX.length) : key;
  };
  return {
    name,
    cards: values.slice(0, cardCount).map((i) => resolve(i, false)),
    spells: values.slice(cardCount).map((i) => resolve(i, true)),
    // Only 4 and 5 are real battlefields; anything else (including v1's absent
    // byte) means the deck does not say, and the caller keeps its current size.
    ...(boardByte === 4 || boardByte === 5 ? { boardSize: boardByte } : {}),
  };
}

// ── sharing by link ────────────────────────────────────────────────────────
// Deliberately pure: these take and return strings and never touch `location`,
// so they are testable in node and the browser globals stay at the call site.

/** The query key a shared link carries the code in. */
export const DECK_LINK_PARAM = "deck";

/** Build a shareable link. `base` is normally `location.origin + location.pathname`.
 *  Codes are base64url, so every character is already URL-safe and needs no
 *  escaping — but it is encoded anyway, because a future format that is not
 *  would otherwise break links silently. */
export function deckLinkFor(code: string, base: string): string {
  const clean = base.replace(/[?#].*$/, "").replace(/\/$/, "");
  return `${clean}/?${DECK_LINK_PARAM}=${encodeURIComponent(code)}`;
}

/** Pull a deck code out of a query string (`location.search`), or null.
 *  Does not decode it — the caller decides what to do with a bad one, so the
 *  error can be shown next to the deck it failed to load. */
export function deckCodeFromUrl(search: string): string | null {
  if (!search) return null;
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = q.get(DECK_LINK_PARAM);
  return raw && raw.trim() ? raw.trim() : null;
}
