// SURFS UP BREAKS ON THE ROW AHEAD — AND ONLY GOES OUT WHEN SOMEBODY IS IN IT.
//
// Kauai's wave hits every opponent in the row directly ahead and nobody else.
// It used to be gated and aimed like an ordinary Special, castable whenever ANY
// enemy was in reach. So it went out into empty rows (2 magic and the recharge
// spent on a heal), the AI and full auto threw it the same way, a Kauai that had
// ridden onto the enemy's back line could fire it at a row that is not on the
// board, and the player was asked to pick a target the wave ignored.
//
// It is a ZONE now, like Thunder Strike: the lit set is the struck set, and an
// empty row is "no opponent in the row ahead". Firing a zone from the board
// sends every lit target, which the engine used to count against `targets` — so
// Thunder Strike threw "Too many targets" at a player with two ELECTRIFIED
// opponents and never fired. Both halves are pinned here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDef } from "../../data/cards";
import { chooseBattleAction } from "../ai";
import { advance, applyIntent } from "../phases";
import { canFireSpecial, previewSpecialWaveRow, specialIsZone, specialTargets } from "../rules";
import type { GameState, PlayerId } from "../types";
import { atBattle, bigPrepState, place, prepState } from "./helpers";

const KAUAI = "aqua_surferdude";

/** The caster up in the queue, paid up and off its summon turn. */
function armed(s: GameState, id: string, magic = 6): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [id], index: 0, awaitingInput: id };
  s.players[s.cards[id].owner].magicPool = magic;
  s.cards[id].summonedThisRound = false;
  s.cards[id].specialCooldown = 0;
  return s;
}
const body = (s: GameState, owner: PlayerId, row: number, col: number, hp = 99) =>
  place(s, "leaf_stickviper", owner, row, col, { curHp: hp, maxHp: Math.max(hp, 99), curShields: 0 });
const ids = (cs: { instanceId: string }[]) => cs.map((c) => c.instanceId).sort();

describe("Surfs Up is a zone: the row directly ahead", () => {
  it("lights exactly the opponents in that row, not everyone in reach", () => {
    const s = bigPrepState();
    const k = place(s, KAUAI, "P1", 4, 1);
    const a = body(s, "P2", 3, 0);
    const b = body(s, "P2", 3, 3);
    body(s, "P2", 1, 2); // in reach, not in the row
    expect(specialIsZone(getDef(KAUAI).special)).toBe(true);
    expect(ids(specialTargets(s, k.instanceId))).toEqual(ids([a, b]));
    expect(previewSpecialWaveRow(s, k.instanceId), "the whole row lights up, empty cells too")
      .toEqual([0, 1, 2, 3, 4].map((col) => ({ row: 3, col })));
  });

  it("fires on a Confirm with two in the row, hits both, and leaves the rest alone", () => {
    const s = bigPrepState();
    const k = place(s, KAUAI, "P1", 4, 1);
    const ally = place(s, "leaf_stickviper", "P1", 4, 2, { curHp: 20, maxHp: 99 });
    const a = body(s, "P2", 3, 0);
    const b = body(s, "P2", 3, 3);
    const c = body(s, "P2", 1, 2);
    armed(s, k.instanceId);
    // What the board sends for a zone: every lit target at once.
    const lit = specialTargets(s, k.instanceId).map((t) => t.instanceId);
    const n = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: lit });
    for (const hit of [a, b]) {
      expect(n.cards[hit.instanceId].curHp, "the wave hit it").toBeLessThan(99);
      expect(n.cards[hit.instanceId].pos!.row, "and shoved it back").toBeLessThan(3);
    }
    expect(n.cards[c.instanceId].curHp, "outside the row: untouched").toBe(99);
    expect(n.cards[c.instanceId].pos).toEqual({ row: 1, col: 2 });
    expect(n.cards[ally.instanceId].curHp, "the crew is buoyed").toBe(23);
    expect(n.players.P1.magicPool).toBe(6 - getDef(KAUAI).special!.cost);
  });

  it("refuses an empty row, even with an opponent in reach", () => {
    const s = bigPrepState();
    const k = place(s, KAUAI, "P1", 4, 1);
    body(s, "P2", 1, 2);
    armed(s, k.instanceId);
    expect(canFireSpecial(s, k.instanceId)).toEqual({ ok: false, reason: "No opponent in the row ahead" });
  });

  it("refuses from the enemy's back row, where there is no row ahead", () => {
    // Riding It In walks Kauai forward on every basic, so a long game leaves it
    // exactly here.
    const s = bigPrepState();
    const k = place(s, KAUAI, "P1", 0, 1);
    body(s, "P2", 0, 3);
    body(s, "P2", 1, 1);
    armed(s, k.instanceId);
    expect(canFireSpecial(s, k.instanceId).ok).toBe(false);
    expect(previewSpecialWaveRow(s, k.instanceId)).toEqual([]);
  });

  it("breaks the other way for P2", () => {
    const s = bigPrepState();
    const k = place(s, KAUAI, "P2", 0, 2);
    const ahead = body(s, "P1", 1, 2);
    body(s, "P1", 3, 2);
    expect(ids(specialTargets(s, k.instanceId))).toEqual(ids([ahead]));
  });
});

describe("the AI and full auto read the same row", () => {
  it("never throw the wave into an empty row", () => {
    const s = bigPrepState();
    const k = place(s, KAUAI, "P1", 4, 1);
    body(s, "P2", 1, 0, 4); // killable and in reach, but NOT in the row
    body(s, "P2", 1, 4);
    armed(s, k.instanceId, 20);
    s.battle!.awaitingInput = null;
    s.cards[k.instanceId].autoMode = "full";
    expect(chooseBattleAction(s, k.instanceId).action).not.toBe("special");
    const n = advance(s);
    expect(n.log.slice(s.log.length).some((l) => l.includes("sends a wave ahead"))).toBe(false);
  });

  it("...and still cast it when the row has somebody to hit", () => {
    const s = bigPrepState();
    const k = place(s, KAUAI, "P2", 1, 2);
    s.players.P2.magicPool = 40;
    body(s, "P1", 2, 1, 900);
    body(s, "P1", 2, 3, 900);
    expect(chooseBattleAction(atBattle(s), k.instanceId).action).toBe("special");
  });
});

describe("a zone fires on a Confirm, however many it lit", () => {
  it("Thunder Strike with two ELECTRIFIED opponents no longer throws 'Too many targets'", () => {
    const s = prepState();
    const storm = place(s, "bolt_storm", "P1", 3, 0);
    const zap = { kind: "ELECTRIFIED" as const, duration: 2, power: 0, source: "BOLT" as const };
    const a = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 14, maxHp: 14, curShields: 0, status: { ...zap } });
    const b = place(s, "leaf_alpha", "P2", 1, 3, { curHp: 14, maxHp: 14, curShields: 0, status: { ...zap } });
    armed(s, storm.instanceId, 5);
    const lit = specialTargets(s, storm.instanceId).map((t) => t.instanceId);
    expect(lit).toHaveLength(2);
    const n = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetIds: lit });
    expect(n.cards[a.instanceId].curHp).toBeLessThan(14);
    expect(n.cards[b.instanceId].curHp).toBeLessThan(14);
  });

  it("the board and the engine ask one predicate what a zone is", () => {
    const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
    const PHASES = readFileSync(join(__dirname, "..", "phases.ts"), "utf8");
    expect(APP, "Confirm fires the lit set").toContain("specialIsZone(activeDef?.special)");
    expect(APP, "and the row lights up when armed").toContain("previewSpecialWaveRow(game, awaitingId)");
    expect(PHASES, "the engine takes the whole list for a zone").toContain("specialIsZone(special)");
  });
});
