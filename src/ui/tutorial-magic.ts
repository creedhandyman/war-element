// THE SECOND SCRIPTED BATTLE: MAGIC — spells, Specials and shields (owner,
// 2026-10-04). Played from the Training Ground's Basics, after the first one
// (ui/tutorial.ts), on the same forced-play rail.
//
// Placing, moving and attacking were the first battle's, so the board is SET,
// not dealt: two cards each, already standing. What is taught, in the order the
// battle shows it:
//
//   round 1, prep    cast a spell (Pebble Toss): 3 damage to a far enemy, and a
//                    shield for your BORE card — paid with Magic
//   round 1, battle  the near enemy hits the Armadillo for 0 — its shields soak
//                    the hit and wear down by one; then Lazor fires its Special
//                    (2 Magic, any range) and the near enemy falls
//   round 2          the last enemy steps up and hits Lazor, who has no
//                    shields, for 5 — the contrast; Lazor's Special is
//                    recharging, so its basic attack finishes the battle
//
// Cards chosen so nothing ELSE fires mid-battle: the Armadillo's one passive,
// Curl Up, regrows a shield at the END of each round (its BLOCK only deepens
// the soak), Lazor's Special is plain damage, and the enemies are
// GALE Dusters, whose element power only adds speed — no status lands on
// anything all battle (`tutorial-script.test.ts` checks).
//
// Patched at setup, as the first battle patches its Grills: P1 starts with 2
// Magic (3 by round 1, for the spell and the Special), the near Duster has 5 HP
// and +3 SP (it must act before Lazor, so the soak is seen first), the far one
// 7 HP (it survives the spell). Fixed seed: the enemy has the first prep turn.
import {
  advance, applyIntent, cardAt, createInitialState, needsInput, summonCard,
  type CardInstance, type GameState, type Intent, type PlayerId,
} from "../engine";
import { prepOver, type Beat, type TutorialDef } from "./tutorial";

export const TUT_MAGIC_DONE = "TUT2_DONE";
export const MAGIC_SEED = 1;

const ARMADILLO = "bore_armadillo";
const LAZOR = "dawn_lazor";
const DUSTER = "gale_duster";
const PEBBLE = "bore_pebble_toss";
export const MAGIC_YOU = [ARMADILLO, LAZOR] as const;

/** Where the cards stand at the start. The near Duster never moves; the far
 *  one steps from (1,3) to (2,3) in round 2. */
const NEAR = { row: 2, col: 1 };
const FAR_START = { row: 1, col: 3 };
const FAR_END = { row: 2, col: 3 };

export function createMagicState(): GameState {
  let s = createInitialState(MAGIC_SEED, [], [], ["P1", "P2"], [PEBBLE], [], 4);
  s = applyIntent(s, { type: "MULLIGAN", player: "P1", returnHandIds: [] });
  s = applyIntent(s, { type: "MULLIGAN", player: "P2", returnHandIds: [] });
  // The reducer handed back a fresh state, so placing on it changes nothing
  // shared. `summonCard` is the one door every arrival takes; standing since
  // before round 1, none of them counts as summoned this round.
  const placed = [
    summonCard(s, "P1", ARMADILLO, { row: 3, col: 1 }),
    summonCard(s, "P1", LAZOR, { row: 3, col: 2 }),
    summonCard(s, "P2", DUSTER, NEAR),
    summonCard(s, "P2", DUSTER, FAR_START),
  ];
  for (const c of placed) c.summonedThisRound = false;
  const [, , near, far] = placed;
  near.curHp = near.maxHp = 5;
  near.spBonus += 3;
  far.curHp = far.maxHp = 7;
  s.players.P1.magicPool = 2;
  s.log.push("The board is set: your Armadillo and Lazor against two Dusters.");
  for (let i = 0; i < 50 && needsInput(s) === null; i++) s = advance(s);
  return s;
}

const alive = (c: CardInstance | undefined): c is CardInstance => !!c && !!c.pos && c.curHp > 0;
const mine = (s: GameState, defId: string) =>
  Object.values(s.cards).find((c) => c.owner === "P1" && c.defId === defId && alive(c));
const foeAt = (s: GameState, row: number, col: number) => {
  const c = cardAt(s, row, col);
  return c && c.owner === "P2" && alive(c) ? c : undefined;
};
const nearDown = (s: GameState) => !foeAt(s, NEAR.row, NEAR.col);
const spellCast = (s: GameState) => s.players.P1.spellbook.some((sl) => sl.defId === PEBBLE && sl.used);
const roundPast = (s: GameState, r: number) => s.round > r || s.phase === "gameover";

/** The enemy's scripted turn; null when it is not the enemy's to take. */
export function magicEnemyStep(s: GameState): GameState | null {
  if (needsInput(s) !== "P2") return null;
  const P2: PlayerId = "P2";
  let intent: Intent = { type: "PASS", player: P2 };
  if (s.phase === "battle") {
    // The near Duster swings at the Armadillo (the soak); the far one, once it
    // has stepped up, at Lazor (no shields). Anything else stands down.
    const actor = s.cards[s.battle?.awaitingInput ?? ""];
    const armadillo = mine(s, ARMADILLO);
    const lazor = mine(s, LAZOR);
    const target = actor?.pos?.row === NEAR.row && actor.pos.col === NEAR.col ? armadillo : lazor;
    intent = target
      ? { type: "BATTLE_ACTION", player: P2, action: "basic", targetId: target.instanceId }
      : { type: "BATTLE_ACTION", player: P2, action: "skip" };
    try { return applyIntent(s, intent); } catch {
      return applyIntent(s, { type: "BATTLE_ACTION", player: P2, action: "skip" });
    }
  }
  const far = foeAt(s, FAR_START.row, FAR_START.col);
  if (s.phase === "prep" && s.round === 2 && far && !s.prep?.movedThisTurn) {
    intent = { type: "MOVE", player: P2, instanceId: far.instanceId, to: FAR_END };
  }
  return applyIntent(s, intent);
}

/** The beat sheet. */
export const MAGIC_BEATS: Beat[] = [
  // ── round 1, prep: a spell ──────────────────────────────────────────────
  { id: "spell-pick", big: "Tap Pebble Toss.", small: "Spells cost Magic. You have 3, and get more every round.",
    pre: { target: { kind: "spellbook" }, big: "Tap Spells.", small: "Spells are cast before the battle, paid with Magic." },
    wait: "The enemy passes.",
    target: { kind: "spell", spellId: PEBBLE },
    done: (s, ui) => ui.spellId === PEBBLE || spellCast(s) },
  { id: "spell-cast", big: "Now tap the far enemy.", small: "3 damage to it, and +1 shield for your BORE card.",
    wait: "Pebble Toss!",
    target: { kind: "slot", row: FAR_START.row, col: FAR_START.col },
    done: (s) => spellCast(s) },
  { id: "pass-1", big: "Tap Pass.", small: "Each spell can be cast once a game.",
    wait: "The enemy passes.",
    target: { kind: "pass" },
    done: (s) => prepOver(s, 1) },
  // ── round 1, battle: shields, then a Special ────────────────────────────
  { id: "special-pick", big: "Lazor's turn. Tap Special.",
    small: "That hit did 0 to its HP. Shields, the silver end of a health bar, soak every hit and wear down.",
    wait: "Battle! Watch the Armadillo's shields.",
    target: { kind: "verb", verb: "special" },
    done: (s, ui) => ui.pending === "special" || nearDown(s) || roundPast(s, 1) },
  { id: "special-hit", big: "Hit the enemy beside you.",
    small: "A Special is a card's big move, paid with Magic. Lazor's costs 2 and reaches anywhere.",
    target: { kind: "slot", row: NEAR.row, col: NEAR.col },
    done: (s) => nearDown(s) || roundPast(s, 1) },
  // ── round 2: no shields, and a Special recharging ───────────────────────
  { id: "pass-2a", big: "Tap Pass.", small: "Magic carries over, and you get 1 more every round.",
    // Shown from the end of round 1's battle until the enemy has moved, so it
    // says nothing that is only true of the second half of that.
    wait: "Watch the last enemy.",
    target: { kind: "pass" },
    done: (s) => roundPast(s, 1) && (!!foeAt(s, FAR_END.row, FAR_END.col) || roundPast(s, 2)) },
  { id: "pass-2b", big: "It moved up. Tap Pass again.", small: "Lazor has no shields. Watch what this hit does.",
    wait: "The enemy passes.",
    target: { kind: "pass" },
    done: (s) => prepOver(s, 2) },
  { id: "attack", big: "Lazor's turn. Tap Attack.",
    small: "That hit went straight to HP. Lazor's Special is recharging, so attack.",
    wait: "Battle!",
    target: { kind: "verb", verb: "basic" },
    done: (s, ui) => ui.pending === "basic" || s.phase === "gameover" },
  { id: "finish", big: "Finish it!",
    target: { kind: "slot", row: FAR_END.row, col: FAR_END.col },
    done: (s) => s.phase === "gameover" },
];

/** What the player's taps on beat `b` amount to, for the headless test. */
export function magicScriptedIntent(s: GameState, b: Beat): Intent | null {
  const P1: PlayerId = "P1";
  switch (b.id) {
    case "spell-cast": {
      const far = foeAt(s, FAR_START.row, FAR_START.col);
      return far ? { type: "CAST_SPELL", player: P1, spellId: PEBBLE, targetId: far.instanceId } : null;
    }
    case "pass-1": case "pass-2a": case "pass-2b":
      return { type: "PASS", player: P1 };
    case "special-hit": {
      const near = foeAt(s, NEAR.row, NEAR.col);
      return near ? { type: "BATTLE_ACTION", player: P1, action: "special", targetId: near.instanceId } : null;
    }
    case "finish": {
      const far = foeAt(s, FAR_END.row, FAR_END.col);
      return far ? { type: "BATTLE_ACTION", player: P1, action: "basic", targetId: far.instanceId } : null;
    }
    default:
      return null; // a selection tap
  }
}

export const MAGIC: TutorialDef = {
  id: "magic",
  mark: TUT_MAGIC_DONE,
  title: "Spells, Specials and shields",
  blurb: "Cast a spell, fire a Special, and see what shields do. Magic pays for both.",
  youCards: MAGIC_YOU,
  foeName: "Dusters",
  create: createMagicState,
  beats: MAGIC_BEATS,
  enemyStep: magicEnemyStep,
  scriptedIntent: magicScriptedIntent,
  result: {
    lead: "You cast a spell, fired a Special, and your shields held.",
    bullets: [
      "Magic pays for Specials and spells. You get more every round.",
      "Spells are cast before the battle, each once a game. Specials fire in battle, then recharge.",
      "Shields soak damage before HP, and wear down as they are hit.",
    ],
  },
};
