import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { basicAttack } from "../combat";
import { boardCards } from "../state";
import { giveHand, place, prepState, statusOf } from "./helpers";

describe("wave 4 — cost-1, one per element", () => {
  it("Birch: a KILL flows into a 4×1 volley on the nearest survivor", () => {
    const s = prepState();
    const birch = place(s, "leaf_birch", "P1", 2, 0, { autoMode: "manual" });
    const dying = place(s, "dusk_gool", "P2", 2, 1, { curHp: 1, maxHp: 20, curShields: 0 });
    // BORE, not DUSK: Midnight Shade gives DUSK cards dodge per FALLEN DUSK
    // ally, so the first kill armed the second body and this assertion rode a
    // coin on the shared RNG stream. The victim's element is incidental here.
    const next = place(s, "bore_rockgoblin", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 3 });
    basicAttack(s, birch.instanceId, dying.instanceId);
    expect(s.cards[dying.instanceId]?.curHp ?? 0).toBeLessThanOrEqual(0); // killed
    // 4 separate 1-DMG hits into the survivor: strips its 3 shields, then 1 to HP.
    expect(s.cards[next.instanceId].curShields).toBe(0);
    expect(s.cards[next.instanceId].curHp).toBe(19);
  });

  it("Staph: Fire Stick BURNs the nearest foe on summon", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const foe = place(s, "dusk_gool", "P2", 1, 2, { curHp: 40, maxHp: 40 }); // not adjacent
    const h = giveHand(s, "P1", "pyro_staph");
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: h, col: 0 });
    expect(statusOf(n.cards[foe.instanceId], "BURN")?.power).toBe(2);
  });

  it("Misty: Fog Settlement makes enemy basics whiff, then clears", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const h = giveHand(s, "P1", "aqua_misty");
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: h, col: 0 });
    expect(n.players.P1.foggedRounds).toBe(1);
    // 200 enemy swings at a P1 card — a 50% fog has to move landed off 100%.
    const attacker = place(n, "dusk_gool", "P2", 2, 1);
    let landed = 0;
    for (let i = 0; i < 200; i++) {
      const victim = place(n, "leaf_greegon", "P1", 3, 3, { curHp: 999, maxHp: 999, curShields: 0 });
      const before = victim.curHp;
      basicAttack(n, attacker.instanceId, victim.instanceId);
      if (n.cards[victim.instanceId].curHp < before) landed++;
      n.cards[attacker.instanceId].attackedThisRound = false;
      n.cards[attacker.instanceId].struckThisRound = {};
      delete n.cards[victim.instanceId];
    }
    expect(landed).toBeGreaterThan(50);
    expect(landed).toBeLessThan(180); // roughly half whiff
  });

  it("Sirocco: Windfist blows the target straight away from the punch", () => {
    // A push travels AWAY FROM THE PUSHER now, not toward the victim's own home
    // row, so a punch thrown from the west sends the target east until it runs
    // out of board. The old rule sent it north whichever side it was hit from —
    // which on this setup meant a sideways blow moved a card backwards.
    const s = prepState();
    const siro = place(s, "gale_sirocco", "P1", 2, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 }); // due east
    basicAttack(s, siro.instanceId, foe.instanceId);
    const at = s.cards[foe.instanceId].pos!;
    expect(at.row, "it was hit along the row, so it travels along the row").toBe(2);
    expect(at.col, "as far as open slots allow — the east wall").toBe(s.boardSize - 1);
  });

  it("Stingray: Piercing Pulse gives PEN vs an ELECTRIFIED foe", () => {
    // Shielded target: without PEN the shields eat hits; with it, straight to HP.
    const plain = prepState();
    const r1 = place(plain, "bolt_stingray", "P1", 2, 0);
    const f1 = place(plain, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 5 });
    basicAttack(plain, r1.instanceId, f1.instanceId);
    const plainToHp = 40 - plain.cards[f1.instanceId].curHp;

    const zapped = prepState();
    const r2 = place(zapped, "bolt_stingray", "P1", 2, 0);
    const f2 = place(zapped, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 5 });
    f2.statuses = [{ kind: "ELECTRIFIED", duration: 2, power: 0, source: "BOLT" }];
    basicAttack(zapped, r2.instanceId, f2.instanceId);
    const penToHp = 40 - zapped.cards[f2.instanceId].curHp;
    expect(penToHp).toBeGreaterThan(plainToHp); // PEN bypassed the shields
  });

  it("Pebble: Rock Slide drops up to 5 rocks on the nearest foe", () => {
    // Each rock is a coin, so over many summons the total must be > 0 (they land)
    // and no single slide exceeds 5 (five rocks, 1 each).
    let total = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = prepState(seed);
      s.players.P1.gold = 5;
      const foe = place(s, "dusk_gool", "P2", 1, 2, { curHp: 40, maxHp: 40, curShields: 0 });
      const h = giveHand(s, "P1", "bore_kcor");
      const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: h, col: 0 });
      const dealt = 40 - n.cards[foe.instanceId].curHp;
      expect(dealt).toBeGreaterThanOrEqual(0);
      expect(dealt).toBeLessThanOrEqual(5);
      total += dealt;
    }
    expect(total).toBeGreaterThan(0);
  });

  it("...and the rocks SCATTER — with two foes in range, both get hit over time", () => {
    let hitA = 0, hitB = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = prepState(seed);
      s.players.P1.gold = 5;
      const a = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
      const b = place(s, "dusk_gool", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
      const h = giveHand(s, "P1", "bore_kcor");
      const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: h, col: 0 });
      if (n.cards[a.instanceId].curHp < 40) hitA++;
      if (n.cards[b.instanceId].curHp < 40) hitB++;
    }
    // A single-target slide would leave one of them untouched every game.
    expect(hitA).toBeGreaterThan(0);
    expect(hitB).toBeGreaterThan(0);
  });

  it("Harrow: Dancing Shadow raises a Specter on summon", () => {
    const s = prepState();
    s.players.P1.gold = 5;
    const h = giveHand(s, "P1", "dusk_harve");
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: h, col: 0 });
    expect(boardCards(n, "P1").filter((c) => c.defId === "dusk_specter_tok")).toHaveLength(1);
  });
});
