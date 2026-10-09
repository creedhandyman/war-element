// THE TRAINING GROUND (owner, 2026-10-02): a row of short practice fights, each
// built around ONE mechanic — statuses, melee vs ranged, the element auras,
// crit, trample, evasion and the keywords.
//
// A lesson is an ordinary match with both decks chosen for it, so the thing it
// teaches actually turns up on the board. The coach (LessonCoach.tsx) then
// explains each idea at the moment it HAPPENS — the first BURN, the first crit,
// the first trample — rather than front-loading a page of rules. A tip whose
// trigger never fires is never shown, which is fine: it is the same rule the
// player can read on the card.
//
// The rule text is quoted from where the game already keeps it (STATUS_TEXT,
// the keyword lines in `describeSharedPassives`, ELEMENT_AURA), never retyped,
// so a balance change to any of them reaches the lesson on its own.
import {
  ELEMENT_AURA, getDef,
  type CardInstance, type CardDef, type Element, type GameState, type Keyword, type StatusKind,
} from "../engine";
import { RANGED_REACH, holdsTheLine, isAirborne, shoveTarget } from "../engine/rules";
import { ELEMENT_BEATS } from "../engine/matchups";
import { homeRow } from "../engine/types";
import { addFreePacks, addShards, type StorySave } from "../data/story";
import { STATUS_TEXT, TANK_BULWARK_TEXT, describeSharedPassives } from "./card-text";

export interface LessonTip {
  id: string;
  title: string;
  body: string;
  /** True once the board shows what this tip is about. Checked on every update;
   *  the first time it holds, the tip is queued for the rest of the fight. */
  when: (g: GameState) => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  /** One line for the lesson list. */
  blurb: string;
  /** What the opponent's seat is called on the intro screen. */
  foeName: string;
  you: string[];
  foe: string[];
  /** Cards dealt first, so the lesson's subject is in the opening hand. */
  youFirst: string[];
  foeFirst?: string[];
  tips: LessonTip[];
}

/** Shards for a lesson's FIRST win. Refights pay nothing — it is practice. */
export const LESSON_SHARDS = 20;
/** Packs for winning every lesson once. */
export const GRADUATION_PACKS = 1;
/** All lessons are fought on the small board: quicker, and the mechanic is
 *  never more than a step or two from where it lands. */
export const LESSON_BOARD = 4;

// ── what the board is showing ───────────────────────────────────────────────

const onBoard = (g: GameState): CardInstance[] => Object.values(g.cards).filter((c) => c.pos && c.curHp > 0);
const fielded = (g: GameState, test: (d: CardDef, c: CardInstance) => boolean) =>
  onBoard(g).some((c) => test(getDef(c.defId), c));
const logged = (g: GameState, re: RegExp) => g.log.some((l) => re.test(l));
const statusSeen = (kind: StatusKind) => (g: GameState) => onBoard(g).some((c) => c.statuses.some((s) => s.kind === kind));
const inPlay = (g: GameState) => g.phase !== "mulligan";

/** A keyword's rule line, read off a card that carries it. */
function keywordRule(kw: Keyword, carrier: string): string {
  const line = describeSharedPassives(getDef(carrier)).find((p) => p.kind === "keyword" && p.label.includes(kw));
  if (!line) throw new Error(`training: ${carrier} does not carry ${kw}`);
  return line.desc;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The eight playable elements — ELEMENT_AURA also holds VOID, the bosses'. */
const ELEMENTS: Element[] = ["PYRO", "BOLT", "LEAF", "DAWN", "AQUA", "BORE", "DUSK", "GALE"];

const STATUS_ORDER: StatusKind[] = [
  "BURN", "BLEED", "DOT", "SCALD", "FREEZE", "PARALYZE", "ROOT", "WEAKEN", "BLIND",
  "FRIGHTEN", "STUN", "SLEEP", "MUTED", "ELECTRIFIED",
];

const KEYWORD_CARRIER: Partial<Record<Keyword, string>> = {
  STEALTH: "bolt_hacker", PEN: "dawn_sphere", LIFESTEAL: "leaf_sakuroot", REGEN: "leaf_greegon",
  BLOCK: "bore_armadillo", REFLECT: "bore_clubber", DRAIN: "dusk_vamp", FLYING: "gale_breeze",
};

// ── the lessons ─────────────────────────────────────────────────────────────

export const LESSONS: Lesson[] = [
  {
    id: "reach",
    title: "Melee and Ranged",
    blurb: "Who can hit whom: the square around a fighter, and the shot over two.",
    foeName: "Sparring Squad",
    you: [
      "leaf_birch", "dawn_flash", "leaf_weeds", "leaf_cactus", "dawn_glime", "leaf_forestdeer", "dawn_stbern",
      "leaf_leaf", "dawn_shine", "dawn_oxin", "leaf_dartfrog", "leaf_hunter", "leaf_gecko", "dawn_quasar",
    ],
    foe: [
      "aqua_blub", "bolt_junker", "aqua_misty", "bolt_stingray", "aqua_kinguin", "aqua_bootlegger", "bolt_drshock",
      "aqua_harp", "bolt_jolt", "bolt_buzz", "aqua_siphon", "bolt_jellyfish", "aqua_coralgolem", "bolt_handyman",
    ],
    youFirst: ["leaf_birch", "leaf_forestdeer", "dawn_glime", "leaf_weeds"],
    tips: [
      {
        id: "reach-intro", title: "Two kinds of attack",
        body: "Every card is MELEE or RANGED — it says which on the card. Melee hits only the eight squares "
          + `touching it. Ranged reaches up to ${RANGED_REACH} squares away in any direction, so it can fight from behind your line.`,
        when: inPlay,
      },
      {
        id: "reach-melee", title: "Melee: get next to it",
        body: "A melee card has to stand beside its target, diagonals included. Walk it forward until an enemy "
          + "is touching it — and remember the enemy can hit back from the same square.",
        when: (g) => fielded(g, (d, c) => c.owner === "P1" && d.attackType === "Melee"),
      },
      {
        id: "reach-ranged", title: "Ranged: mind the line",
        body: `A ranged card shoots anything within ${RANGED_REACH} squares, but an ENEMY standing on the straight line `
          + "between it and the target blocks the shot (your own cards never do). Keep shooters behind your fighters "
          + "and pick targets the front line isn't covering.",
        when: (g) => fielded(g, (d, c) => c.owner === "P1" && d.attackType === "Ranged"),
      },
      {
        // KING OF THE HILL's reach half (`rangedReachFor`): a ranged card that
        // has left its own home row sees one square further, and keeps it as it
        // pushes on. Owner's call (2026-10-02) to teach it here — it is the one
        // reason to march a shooter forward rather than park it at the back.
        id: "reach-hill", title: "Step out to see further",
        body: `Move a ranged card off your home row onto the battlefield and its reach grows from ${RANGED_REACH} `
          + `to ${RANGED_REACH + 1} squares. It keeps the bonus anywhere past your home row, so a shooter that `
          + "pushes forward can hit targets a back-line shooter cannot. Melee cards do not get it.",
        when: (g) => fielded(g, (d, c) => c.owner === "P1" && d.attackType === "Ranged"
          && c.pos!.row !== homeRow("P1", g.boardSize)),
      },
      {
        id: "reach-bulwark", title: "Tanks and Warriors hold the line",
        body: `A Tank or Warrior is a wall for its side: ${TANK_BULWARK_TEXT} Go around it, or break it first.`,
        when: (g) => fielded(g, (d, c) => c.owner === "P2" && holdsTheLine(d)),
      },
    ],
  },
  {
    id: "statuses",
    title: "Statuses",
    blurb: "Burn, bleed, freeze, root and the rest — what each one does to a card.",
    foeName: "Training Dummies",
    you: [
      // One carrier for every status the lesson explains: SLEEP (Ankylosaur),
      // SCALD (Spinefin) and MUTED (Webster) had none, so their tips never fired.
      "leaf_stickviper", "aqua_subcool", "bolt_twotales", "dusk_grafft", "bolt_webster", "aqua_spinefin", "bolt_scrapper",
      "leaf_python", "pyro_ember_scorpion", "dawn_quasar", "dusk_gool", "gale_klouy", "pyro_wick", "bore_ankylosaur",
    ],
    foe: [
      "bore_hillbilly", "leaf_birch", "dusk_zombie_husk", "dawn_glime", "leaf_cactus", "aqua_bootlegger", "dusk_skeleton_knight",
      "aqua_blub", "pyro_ingit", "dusk_pumpkin", "leaf_weeds", "dawn_stbern", "aqua_misty", "leaf_birch",
    ],
    youFirst: ["leaf_stickviper", "aqua_subcool", "bolt_twotales", "bore_ankylosaur"],
    tips: [
      {
        id: "st-intro", title: "Hits that linger",
        body: "Every card in this deck leaves something behind when it hits — a STATUS. Statuses show as small "
          + "badges on the card, and tapping a card lists what each one is doing and for how many rounds.",
        when: inPlay,
      },
      ...STATUS_ORDER.map((kind): LessonTip => ({
        id: `st-${kind}`,
        title: kind,
        body: STATUS_TEXT[kind],
        when: statusSeen(kind),
      })),
    ],
  },
  {
    id: "auras",
    title: "Element Auras",
    blurb: "Every element gives all its cards a shared power. Meet all eight.",
    foeName: "The Four Corners",
    you: [
      "pyro_sparky", "bolt_stingray", "leaf_birch", "dawn_glime", "pyro_firecrack", "bolt_jellyfish", "leaf_cactus",
      "leaf_cactus", "dawn_stbern", "dawn_stbern", "pyro_dyna", "bolt_buzz", "pyro_chopper", "bolt_jellyfish",
    ],
    foe: [
      "aqua_blub", "bore_crock", "dusk_pumpkin", "gale_hawko", "aqua_misty", "bore_hillbilly", "bore_cosmic",
      "dusk_doom", "dusk_zombie_husk", "aqua_kinguin", "aqua_coralgolem", "dusk_zombie_husk", "bore_old_timer", "bore_hillbilly",
    ],
    youFirst: ["pyro_sparky", "bolt_stingray", "leaf_birch", "dawn_glime"],
    foeFirst: ["aqua_blub", "bore_crock", "dusk_pumpkin", "gale_hawko"],
    tips: [
      {
        id: "au-intro", title: "One element, one aura",
        body: "Each card belongs to one of eight elements, and every card of an element shares that element's "
          + "AURA — a power it has without printing it. You bring PYRO, BOLT, LEAF and DAWN; they bring the other four. "
          + "Each aura is explained the first time one of its cards reaches the board.",
        when: inPlay,
      },
      ...ELEMENTS.map((el): LessonTip => ({
        id: `au-${el}`,
        title: `${el} — ${ELEMENT_AURA[el].name}`,
        body: ELEMENT_AURA[el].desc,
        when: (g) => fielded(g, (d) => d.element === el),
      })),
      {
        id: "au-matchup", title: "The element wheel",
        body: "Every element is strong against one other and weak against one: +25% damage to the element it "
          + "beats, +25% taken from the one that beats it. PYRO burns LEAF, LEAF roots BORE, BORE grounds BOLT, "
          + "BOLT strikes GALE, GALE churns AQUA, AQUA douses PYRO, and DAWN and DUSK beat each other. "
          + "Every card shows its own line.",
        // As soon as two elements that meet on the wheel share the board.
        when: (g) => {
          const els = new Set(Object.values(g.cards).filter((c) => c.pos && c.curHp > 0).map((c) => getDef(c.defId).element));
          return [...els].some((el) => { const b = ELEMENT_BEATS[el]; return b !== undefined && els.has(b); });
        },
      },
    ],
  },
  {
    id: "crit",
    title: "Critical Hits",
    blurb: "Double damage on a coin — and the armour that switches it off.",
    foeName: "Shieldwall",
    you: [
      "bore_sling", "aqua_icyninza", "aqua_icynin", "aqua_blub", "leaf_birch", "dawn_glime", "aqua_bootlegger",
      "leaf_cactus", "dusk_skeleton_knight", "bore_crock", "bore_krysteel", "bolt_striik", "dusk_brute", "dusk_ender",
    ],
    foe: [
      "bore_hillbilly", "bolt_jolt", "pyro_firecrack", "dawn_stbern", "dusk_harve", "aqua_siphon", "bolt_handyman",
      "aqua_coralgolem", "bore_armadillo", "pyro_slag_tortoise", "gale_luna", "dusk_zhunk", "gale_wailverine", "leaf_cactus",
    ],
    youFirst: ["bore_sling", "aqua_icyninza", "aqua_icynin", "aqua_blub"],
    tips: [
      {
        id: "cr-intro", title: "CRIT",
        body: `A card with CRIT: ${keywordRule("CRIT", "bore_sling")}`,
        when: inPlay,
      },
      {
        id: "cr-shields", title: "Shields stop crits",
        body: "This enemy has SHIELDS. While a target has even one shield, CRIT can't fire on it. "
          + "Knock the shields off with ordinary hits first — or aim your crit cards at something unshielded.",
        when: (g) => fielded(g, (_d, c) => c.owner === "P2" && c.curShields > 0),
      },
      {
        id: "cr-first", title: "That was a crit",
        body: "Double damage. Crits come from BASIC attacks only, and each hit rolls on its own — a card that hits "
          + "several times gets several chances.",
        when: (g) => logged(g, / CRITS /),
      },
    ],
  },
  {
    id: "trample",
    title: "Trample",
    blurb: "Heavy cards that walk straight through lighter ones.",
    foeName: "The Light Brigade",
    you: [
      "gale_stormhide_bison", "dawn_musk_ox", "gale_buf", "leaf_weeds", "leaf_birch", "dawn_glime", "leaf_forestdeer",
      "dawn_stbern", "aqua_harp", "leaf_cactus", "bore_rhino", "aqua_polarbear", "bore_bolder", "dawn_warphant",
    ],
    foe: [
      "bore_crock", "pyro_sparky", "dusk_crow", "aqua_blub", "dawn_flash", "aqua_misty", "leaf_weeds",
      "gale_megair", "pyro_florence", "bolt_stingray", "dawn_able", "aqua_misty", "dusk_jackl", "gale_hawko",
    ],
    youFirst: ["gale_stormhide_bison", "dawn_musk_ox", "gale_buf", "leaf_weeds"],
    foeFirst: ["bore_crock", "pyro_sparky", "dusk_crow", "aqua_blub"],
    tips: [
      {
        id: "tr-intro", title: "TRAMPLE",
        body: `A card with TRAMPLE: ${keywordRule("TRAMPLE", "dawn_musk_ox")}`,
        when: inPlay,
      },
      {
        id: "tr-ready", title: "Walk through it",
        body: "One of your tramplers is next to a lighter enemy. Use your move this turn to step it ONTO that "
          + "enemy's square: you take the square and drive the enemy back.",
        when: (g) => g.phase === "prep" && onBoard(g).some((c) => c.owner === "P1"
          && onBoard(g).some((e) => e.owner === "P2" && e.pos && shoveTarget(g, c, e.pos) !== null)),
      },
      {
        id: "tr-done", title: "Trampled",
        body: "The square is yours and the enemy has been shoved out of the way. Weight is MAX HP: an ordinary "
          + "trampler only moves cards with less than its own, so the heavy cards are the ones that get pushed around least.",
        when: (g) => logged(g, / bulls through /),
      },
      {
        id: "tr-flyer", title: "Fliers are overhead",
        body: "That enemy FLIES, and there is nothing underfoot to push: a trampler can't move a flier unless a "
          + "status (ROOT, FREEZE, STUN, SLEEP or PARALYZE) has grounded it.",
        when: (g) => onBoard(g).some((c) => c.owner === "P2" && isAirborne(c)),
      },
    ],
  },
  {
    id: "evasion",
    title: "Evasion and Flying",
    blurb: "Cards that are hard to hit — and how to land a blow on them anyway.",
    foeName: "Brawlers",
    you: [
      "leaf_stickers", "gale_tumbleweed", "dusk_crow", "gale_hawko", "leaf_birch", "dawn_glime", "aqua_bootlegger",
      "leaf_cactus", "leaf_forestdeer", "dusk_duet", "dusk_silkstalker", "gale_masala", "aqua_owlette", "pyro_sseerr",
    ],
    foe: [
      "aqua_blub", "leaf_birch", "pyro_ingit", "aqua_bootlegger", "dawn_glime", "dusk_skeleton_knight", "leaf_cactus",
      "gale_wailverine", "dusk_zhunk", "bolt_buzz", "gale_windsor", "bore_crock", "pyro_firecrack", "dusk_doom",
    ],
    youFirst: ["leaf_stickers", "gale_tumbleweed", "dusk_crow", "gale_hawko"],
    tips: [
      {
        id: "ev-intro", title: "EVASION",
        body: `A card with EVASION: ${keywordRule("EVASION", "gale_tumbleweed")} The coin is per HIT, so an attack `
          + "that hits several times will usually land some of them.",
        when: inPlay,
      },
      {
        id: "ev-first", title: "Dodged",
        body: "That hit missed completely. Evasive cards tend to have little HP, so they live on that coin: point them "
          + "at cards that hit once, and keep them away from cards that hit many times.",
        when: (g) => logged(g, / evades a hit /),
      },
      {
        id: "ev-flying", title: "FLYING",
        body: `A card with FLYING: ${keywordRule("FLYING", "dusk_crow")} Ranged attacks still reach it, so a flier `
          + "is safest against a melee army like this one.",
        when: (g) => onBoard(g).some((c) => c.owner === "P1" && isAirborne(c)),
      },
    ],
  },
  {
    id: "keywords",
    title: "Keywords",
    blurb: "Stealth, Pen, Lifesteal, Regen, Block, Reflect and Drain.",
    foeName: "Old Hands",
    you: [
      "dawn_sphere", "dusk_vamp", "bore_clubber", "dawn_ballista", "dawn_reflection", "gale_breeze", "leaf_greegon",
      "leaf_sakuroot", "bolt_hacker", "bore_armadillo", "dusk_scarlett", "leaf_dande", "leaf_sumerose", "leaf_darth",
    ],
    foe: [
      "bolt_junker", "aqua_kinguin", "bore_thorny_ripper", "leaf_cactus", "dusk_skeleton_knight", "aqua_harp", "bolt_drshock",
      "pyro_slag_tortoise", "dawn_oxin", "gale_wailverine", "aqua_misty", "bore_stone", "dusk_pumpkin", "leaf_weeds",
    ],
    youFirst: ["dawn_sphere", "dusk_vamp", "bore_clubber", "dawn_reflection"],
    tips: [
      {
        id: "kw-intro", title: "Keywords",
        body: "The capital words on a card — STEALTH, PEN, BLOCK and so on — are KEYWORDS: rules that card always "
          + "follows. Tap a card to read its keywords any time. Each one here is explained the first time it reaches the board.",
        when: inPlay,
      },
      ...(Object.entries(KEYWORD_CARRIER) as [Keyword, string][]).map(([kw, carrier]): LessonTip => ({
        id: `kw-${kw}`,
        title: kw,
        body: cap(keywordRule(kw, carrier)),
        when: (g) => fielded(g, (d) => Boolean(d.keywords[kw])),
      })),
    ],
  },
];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
export const lessonDone = (save: StorySave, id: string): boolean => (save.trainingDone ?? []).includes(id);

/** Record a won lesson and pay it. A lesson already won returns the save
 *  unchanged, so a refight is free practice and never a farm. The last new
 *  lesson also pays the graduation packs, in the same write. */
export function completeLesson(save: StorySave, id: string): StorySave {
  if (!lessonById(id) || lessonDone(save, id)) return save;
  const done = [...(save.trainingDone ?? []), id];
  let next = addShards({ ...save, trainingDone: done }, LESSON_SHARDS);
  if (LESSONS.every((l) => done.includes(l.id))) next = addFreePacks(next, GRADUATION_PACKS);
  return next;
}
