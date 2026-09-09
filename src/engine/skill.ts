// SKILL — how much of the game the AI opponent knows.
//
// The difficulty ladder in `custom-decks.ts` moves the DECK: easy is a melee
// pile with no front line, elite is a good list with an opening it cannot
// stumble on. That file's own note says why it had to be that way — "the
// opponent does not have a skill dial: `chooseBattleAction` is one rule set and
// it plays the same way behind every list."
//
// It does now, and it needed one. A weak deck in the hands of a player who
// never misses a lethal, never wastes a Special, reads the whole board for the
// biggest threat and paths a flanking route around your line is still a player
// who beats someone learning the rules. The list was never what was hurting
// them. What hurts is that the opponent has read the manual.
//
// WHAT IS TAKEN AWAY IS KNOWLEDGE, NOT COMPETENCE, and that distinction is the
// whole design. Every switch here removes something the AI has to LOOK UP —
// exact lethality, class threat, a pathed route, the spellbook — and none of
// them removes its ability to play. A `learning` opponent still summons on
// curve, still walks forward, still attacks, still takes the capture win, and
// still breaks a standoff. It will beat a player who does nothing. It just
// fights like someone who has not noticed that the Mage in the back row is the
// problem, or that the thing in front of it is one hit from dead.
//
// The alternative — a random chance to pass or to throw a turn away — was not
// built, for the reason `suits.ts` gives about Clubs: an AI that declines to act
// does not read as easy, it reads as broken, and a new player cannot learn
// anything from an opponent whose mistakes have no logic to them. A novice who
// hits the wrong target is teaching you target priority. A novice who freezes is
// teaching you nothing.
//
// ─────────────────────────────────────────────────────────────────────────
// MEASURED against a `sharp` opponent, the handicapped seat playing BOTH chairs
// so the second-seat advantage cancels, 360 games a row over the shipped 4x4
// premade field with real spellbooks on both sides:
//
//     sharp      53.3%   the opponent that shipped — every switch on
//     steady     42.2%   no plans, no value-spending
//     learning   23.1%   every switch off
//
// Read those as differences, not as absolutes: the handicapped seat holds the
// same deck in both chairs while its opponent rotates through the field, so the
// 53.3% baseline carries that pairing's own bias. The rungs are 11.1 and 30.2
// points below it.
//
// WHAT EACH SWITCH IS ACTUALLY WORTH, alone:
//
//     -spells      32.8%   -20.5   by far the largest
//     -plans       44.3%    -9.0
//     -readsMagic  51.1%    -2.2
//     -readsThreat, -readsLethal, -readsCurve, -guardsHome   under a point each
//
// THE SPELLBOOK IS MOST OF THE OPPONENT'S EDGE, which was not the guess. A
// one-shot spell landing on the turn it decides the game is also the least
// legible thing the AI does, so the biggest lever and the most opaque knowledge
// turn out to be the same thing. `-guardsHome` measured slightly POSITIVE,
// i.e. guarding the home row is not worth what it costs — noted here as a real
// finding about the AI rather than about this feature.
//
// AND THE TABLE UNDERSTATES THE TACTICAL SWITCHES. This is AI against AI, where
// a missed lethal is a missed lethal against an opponent that will not punish
// the tempo; against a person it is their card surviving a turn they expected to
// lose it, which is the difference they will actually feel. `readsLethal` and
// `readsThreat` measure near zero here and stay in `learning` for that reason —
// the win-rate column is evidence, not the whole account.
import type { GameState } from "./types";

export type { AiSkill } from "./types";
import type { AiSkill } from "./types";

/** In ladder order, gentlest first — which is also the order they are offered. */
export const AI_SKILLS: readonly AiSkill[] = ["learning", "steady", "sharp"];

export interface SkillProfile {
  key: AiSkill;
  /** One word, for the picker. */
  name: string;
  /** One line, in the game's voice, saying what this opponent does NOT do — a
   *  handicap the player cannot see the shape of is one they cannot decide to
   *  turn off. */
  blurb: string;
  /** Does it read its spellbook? A one-shot spell landing on the turn it wins
   *  the game is the single most opaque thing the opponent does, and the thing a
   *  new player has no way to have seen coming. */
  spells: boolean;
  /** Does it PLAN — the pathed flanking step and the closing press? Both are
   *  BFS routes around a line rather than a move toward the enemy home, so they
   *  are foresight in the purest form the AI has. The stall-breaker is NOT
   *  gated: camping until the round cap is not a difficulty, it is a bad game. */
  plans: boolean;
  /** Does it compute exact lethality (`willKill` over the volley estimate,
   *  penetration and evasion included) and finish the wounded card? With this
   *  off it swings at whatever it picked for other reasons and lets kills walk
   *  — the most human mistake in the game. */
  readsLethal: boolean;
  /** Does it rank targets by threat — Assassins and Mages first, then raw
   *  damage? Off, it hits whatever its target list offers first. */
  readsThreat: boolean;
  /** Does it notice an invader standing on its own Home row and kill that
   *  first? A capture is the win condition, so this is the opponent knowing
   *  what it is defending. */
  guardsHome: boolean;
  /** Does it know which of its own cards is the right one to play? On, the hand
   *  is sorted by the suit's taste (the hardest hitter, the toughest wall, the
   *  caster). Off, it plays them in the order they were drawn — it has the
   *  cards, it just has not learned what they are for. */
  readsCurve: boolean;
  /** Does it spend Magic for VALUE — a wide barrage, a status on a cluster, a
   *  buff while the pool would otherwise rot — or only to secure a kill? Off, it
   *  sits on its magic the way a new player does, and Specials appear only when
   *  something is about to die anyway. */
  readsMagic: boolean;
}

export const SKILL_PROFILES: Record<AiSkill, SkillProfile> = {
  learning: {
    key: "learning", name: "Learning",
    blurb: "Plays its cards straight. Misses kills, ignores your casters, and never opens its spellbook.",
    spells: false, plans: false, readsLethal: false, readsThreat: false, guardsHome: false,
    readsCurve: false, readsMagic: false,
  },
  steady: {
    key: "steady", name: "Steady",
    blurb: "Fights hard in front of it, but will not path around your line and hoards its Magic for the kill.",
    spells: true, plans: false, readsLethal: true, readsThreat: true, guardsHome: true,
    readsCurve: true, readsMagic: false,
  },
  sharp: {
    key: "sharp", name: "Sharp",
    blurb: "Knows the whole game. Takes every kill, reads every threat, and will path around you.",
    spells: true, plans: true, readsLethal: true, readsThreat: true, guardsHome: true,
    readsCurve: true, readsMagic: true,
  },
};

/** The knowledge the AI seats are playing with in this match.
 *
 *  ONE DIAL FOR THE WHOLE TABLE, not one per seat. It is a handicap the human
 *  sets for their own benefit, and `humans` already says which seats it can
 *  possibly apply to — a per-seat version would let a free-for-all deal three
 *  opponents of three different competences, which is a difficulty nobody chose.
 *
 *  Absent = `sharp`, so every state built before the dial existed — a saved
 *  game, a replay, every fixture in the suite — plays exactly the opponent it
 *  always did. */
export function skillOf(state: GameState, seat?: string): SkillProfile {
  if (WE_SKILL_SEAT && seat && seat !== WE_SKILL_SEAT) return SKILL_PROFILES.sharp;
  return SKILL_PROFILES[state.aiSkill ?? "sharp"];
}

/** HARNESS ONLY — confine the dial to ONE seat, so a handicapped opponent can
 *  be measured against a sharp one. Null in shipped code, where the dial is
 *  table-wide by design (see `skillOf`) and the other seat is a human anyway.
 *
 *  A win-rate table needs an asymmetry the real game never has, and there is no
 *  other way to get one out of a dial that is deliberately table-wide. */
export let WE_SKILL_SEAT: string | null = null;
export const weSetSkillSeat = (seat: string | null) => { WE_SKILL_SEAT = seat; };
