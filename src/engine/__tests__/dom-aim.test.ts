// SPECIALS THAT POINT "AHEAD" ARE AIMED ON DOMINATION'S BOARD (owner's call,
// 2026-09-29: "the other spells that will be severely limited by not being
// able to angle their special attack in domination mode").
//
// On a board you cross, ahead is the only direction that matters. On
// Domination's the objectives sit in four corners and the enemy comes from all
// of them, so a Special locked to one direction can only threaten a quarter of
// the board. The corridors were already aimed; now every shape laid out from
// its caster is (`specialAimable`): the row ahead, the wave, the lane, the far
// edge, the far-row roots and the column charge. The first pick names the
// direction (`aimFor`) and the Special resolves pointed that way.
import { describe, expect, it } from "vitest";
import { DOMINATION_7X7, newDomination } from "../../data/domination";
import { getDef } from "../../data/cards";
import { advance, applyIntent, createInitialState } from "../index";
import { chooseBattleAction } from "../ai";
import {
  bestAimPick, previewSpecialAim, previewSpecialFarRow, specialAimable, specialTargets,
} from "../rules";
import { summonCard } from "../state";
import { atBattle, place, prepState } from "./helpers";
import type { CardInstance, GameState, PlayerId } from "../types";

const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];

function domState(): GameState {
  let s: GameState = createInitialState(7, DECK, DECK, ["P1", "P2"], undefined, [], DOMINATION_7X7.boardSize);
  s.domination = newDomination(DOMINATION_7X7);
  s.players.P1.mulliganDone = true;
  s.players.P2.mulliganDone = true;
  for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
  s.phase = "prep";
  s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
  return s;
}

/** P1's `defId` on (row,col) of the 7x7, with sturdy P2 weeds at `foes`. */
function board(defId: string, at: [number, number], foes: [number, number][]) {
  const s = domState();
  const me = summonCard(s, "P1", defId, { row: at[0], col: at[1] } as never);
  me.summonedThisRound = false;
  s.players.P1.magicPool = 20;
  const them = foes.map(([r, c]) => {
    const v = summonCard(s, "P2" as PlayerId, "leaf_weeds", { row: r, col: c } as never);
    v.curHp = 40; v.maxHp = 40; v.curShields = 0;
    return v;
  });
  return { s, me, them };
}

/** Fire `me`'s Special aimed by a pick on `pick`; what each foe lost. */
function fire(s: GameState, me: CardInstance, them: CardInstance[], pick: CardInstance) {
  const b = atBattle(s);
  b.battle = { queue: [me.instanceId], index: 0, awaitingInput: me.instanceId };
  const out = applyIntent(b, {
    type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: [pick.instanceId],
  } as never);
  return { out, lost: them.map((v) => 40 - (out.cards[v.instanceId]?.curHp ?? 0)) };
}

const ids = (cs: CardInstance[]) => cs.map((c) => c.instanceId).sort();

describe("which Specials are aimed", () => {
  it("every shape laid out ahead of its caster, and nothing else", () => {
    for (const id of ["aqua_blackice", "aqua_surferdude", "bore_the_coreborer", "gale_masala",
      "leaf_season", "dawn_warphant", "aqua_octoirate", "pyro_pyrogon"])
      expect(specialAimable(getDef(id).special), id).toBe(true);
    for (const id of ["gale_kloud", "aqua_cryo", "leaf_sumerose", "dusk_skelider"])
      expect(specialAimable(getDef(id).special), id).toBe(false);
  });
});

describe("aimed on Domination's board", () => {
  it("the row ahead turns to face the pick (Black Ice, aimed left)", () => {
    // Forward for P1 is up the board (row 2). The left-hand rank is column 1.
    const { s, me, them } = board("aqua_blackice", [3, 2], [[3, 1], [4, 1], [2, 2], [3, 0]]);
    const [left, leftLow, ahead] = them; // them[3] stands two ranks out
    // Offered: the rank ahead of it in all four directions — not two away.
    expect(ids(specialTargets(s, me.instanceId))).toEqual(ids([left, leftLow, ahead]));
    const { lost } = fire(s, me, them, left);
    expect(lost[0]).toBeGreaterThan(0);
    expect(lost[1], "the rest of the left rank").toBeGreaterThan(0);
    expect(lost[2], "forward is not where it was aimed").toBe(0);
    expect(lost[3], "two ranks out").toBe(0);
  });

  it("the wave breaks where it is sent (Surfer Dude, aimed down)", () => {
    const { s, me, them } = board("aqua_surferdude", [3, 2], [[4, 2], [4, 3], [2, 2]]);
    // Nothing to aim until it is pointed: no fixed row is drawn in advance.
    expect(previewSpecialAim(s, me.instanceId, them[1])!.every((c) => c.row === 4)).toBe(true);
    const { lost } = fire(s, me, them, them[1]);
    expect(lost[0]).toBeGreaterThan(0);
    expect(lost[1]).toBeGreaterThan(0);
    expect(lost[2], "the rank it was not sent to").toBe(0);
  });

  it("the lane runs the way it is pointed (Coreborer, aimed along the row)", () => {
    const { s, me, them } = board("bore_the_coreborer", [3, 2], [[3, 4], [3, 6], [1, 2]]);
    const { lost } = fire(s, me, them, them[0]);
    expect(lost[0]).toBeGreaterThan(0);
    expect(lost[1], "further down the same lane").toBeGreaterThan(0);
    expect(lost[2], "its own column, which it was not pointed down").toBe(0);
  });

  it("the far edge is the one it is aimed at (Masala, aimed right)", () => {
    const { s, me, them } = board("gale_masala", [3, 2], [[3, 6], [6, 6], [0, 3]]);
    const { lost } = fire(s, me, them, them[0]);
    expect(lost[0]).toBeGreaterThan(0);
    expect(lost[1], "the whole right-hand edge").toBeGreaterThan(0);
    expect(lost[2], "the top edge, forward for P1").toBe(0);
  });

  it("delayed far-row roots keep the direction of the cast (Season, aimed left)", () => {
    const { s, me, them } = board("leaf_season", [3, 2], [[3, 1], [2, 0], [2, 2]]);
    expect(previewSpecialFarRow(s, me.instanceId), "no far row until it is aimed").toEqual([]);
    const { out } = fire(s, me, them, them[0]);
    expect(out.cards[them[0].instanceId].statuses.some((st) => st.kind === "ROOT")).toBe(true);
    expect(out.cards[them[2].instanceId].statuses.some((st) => st.kind === "ROOT"), "forward").toBe(false);
    expect(out.players.P1.pendingFarRoots?.[0]?.dir).toEqual({ dr: 0, dc: -1 });
    expect(out.specialAim, "the aim does not outlive the cast").toBeUndefined();
  });

  it("the column charge rides the lane it is aimed down (WarPhant, aimed right)", () => {
    const { s, me, them } = board("dawn_warphant", [3, 0], [[3, 4], [2, 0]]);
    const { out, lost } = fire(s, me, them, them[0]);
    expect(out.cards[me.instanceId].pos).toEqual({ row: 3, col: 3 });
    expect(lost[0], "the first body in the lane").toBeGreaterThan(0);
    expect(lost[1], "straight ahead, which it was not aimed at").toBe(0);
  });

  it("a melee caster's footprint is only what it can reach of the rank", () => {
    // Black Ice swings at king-step range: aimed down from (3,2) it can hit
    // (4,1)-(4,3) and nothing further along that rank, so nothing further lights.
    const { s, me, them } = board("aqua_blackice", [3, 2], [[4, 1], [4, 0]]);
    const lit = previewSpecialAim(s, me.instanceId, them[0])!.map((c) => `${c.row},${c.col}`).sort();
    expect(lit).toEqual(["4,1", "4,2", "4,3"]);
    const { lost } = fire(s, me, them, them[0]);
    expect(lost[0]).toBeGreaterThan(0);
    expect(lost[1], "unlit, out of its reach").toBe(0);
  });

  it("a pick one rank ahead but files over still points ahead, not sideways", () => {
    // (2,5) from (3,2) is mostly sideways, but sideways is not a line it
    // stands on: the aim has to be the direction that actually reaches it.
    const { s, me, them } = board("gale_masala", [3, 2], [[0, 5]]);
    expect(previewSpecialAim(s, me.instanceId, them[0])!.every((c) => c.row === 0)).toBe(true);
  });
});

describe("the AI aims too", () => {
  it("points the Special where it catches the most", () => {
    const { s, me, them } = board("aqua_blackice", [3, 2], [[2, 2], [3, 1], [4, 1]]);
    const pick = bestAimPick(s, me.instanceId);
    expect([them[1].instanceId, them[2].instanceId]).toContain(pick);
    s.phase = "battle";
    const choice = chooseBattleAction(s, me.instanceId);
    if (choice.action === "special")
      expect([them[1].instanceId, them[2].instanceId]).toContain(choice.targetId);
  });
});

describe("off Domination nothing is aimed", () => {
  it("the row ahead is still the row ahead, and nothing else is offered", () => {
    const s = prepState();
    const me = place(s, "aqua_blackice", "P1", 2, 1);
    const ahead = place(s, "leaf_weeds", "P2", 1, 1);
    place(s, "leaf_weeds", "P2", 2, 0); // beside it: the left rank on Domination
    expect(ids(specialTargets(s, me.instanceId))).toEqual(ids([ahead]));
    expect(bestAimPick(s, me.instanceId)).toBeUndefined();
    expect(previewSpecialAim(s, me.instanceId, ahead)).toBeNull();
  });
});
