// THE AI'S BLIND SPOTS — three rules that could not see what a Special or a
// spell was FOR, and the tests that keep them seeing it.
//
// A pre-beta audit of every card (100,800 AI-vs-AI matches) found:
//  1. Strike Specials that hit no harder than the card's own basic almost never
//     fired, whatever they carried — the rule weighed damage and nothing else.
//  2. A card whose basic had nothing in reach SKIPPED its turn, even when its
//     Special (a charge, a longer reach) could land.
//  3. Seven spells were never cast at all: status-only sweeps scored zero, a row
//     heal was read as a sweep, and two Special discounts were read as gold
//     conversions.
//
// Each block pairs the case that should fire with the nearest case that should
// not, so a rule that simply fires everything cannot pass.
import { describe, expect, it } from "vitest";
import { aiPrepIntent, chooseBattleAction } from "../ai";
import { bigPrepState, place } from "./helpers";
import type { GameState, Intent } from "../types";

/** A battle-phase board with P2 to act and magic to spare for any suit. */
function battle(): GameState {
  const s = bigPrepState(7, "P2");
  s.phase = "battle";
  s.players.P2.magicPool = 30;
  return s;
}

/** A prep-phase board where P2 can only cast: no gold, one spell in the book. */
function prepWith(spellId: string, magic: number): GameState {
  const s = bigPrepState(1, "P2");
  s.players.P2.gold = 0;
  s.players.P2.magicPool = magic;
  s.players.P2.spellbook = [{ defId: spellId, used: false }];
  return s;
}

const cast = (intent: Intent, spellId: string) =>
  intent.type === "CAST_SPELL" && intent.spellId === spellId;

describe("a Special is weighed on what it carries, not only what it hits for", () => {
  it("Valcana bursts into a crowd — the splash reaches every other opponent", () => {
    const s = battle();
    const me = place(s, "bore_valcana", "P2", 1, 2); // basic 5x2; Special 5 + DOT 2 + 2 to all others
    place(s, "leaf_greegon", "P1", 2, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    for (const col of [0, 1, 4])
      place(s, "leaf_greegon", "P1", 4, col, { curHp: 900, maxHp: 900, curShields: 0 });
    expect(chooseBattleAction(s, me.instanceId).action).toBe("special");
  });

  it("...but swings at a lone target, where the burst has nobody to land on", () => {
    const s = battle();
    const me = place(s, "bore_valcana", "P2", 1, 2);
    place(s, "leaf_greegon", "P1", 2, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    expect(chooseBattleAction(s, me.instanceId).action).toBe("basic");
  });

  it("SLEEP is worth what the sleeper would have hit for (Kobra)", () => {
    const s = battle();
    const me = place(s, "bore_kobra", "P2", 1, 2); // basic 10; Special 10 + SLEEP 2
    const brute = place(s, "bore_kobra", "P1", 2, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    const act = chooseBattleAction(s, me.instanceId);
    expect(act.action).toBe("special");
    expect(act.targetId).toBe(brute.instanceId);
  });

  it("...and worth nothing on a card that is already asleep", () => {
    const s = battle();
    const me = place(s, "bore_kobra", "P2", 1, 2);
    place(s, "bore_kobra", "P1", 2, 2, {
      curHp: 900, maxHp: 900, curShields: 0,
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    expect(chooseBattleAction(s, me.instanceId).action).toBe("basic");
  });

  it("a Special that only matches the basic, and carries nothing, still loses to it (Lazor)", () => {
    const s = battle();
    const me = place(s, "dawn_lazor", "P2", 1, 2); // basic 7; Special 7, no rider
    place(s, "leaf_greegon", "P1", 2, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    expect(chooseBattleAction(s, me.instanceId).action).toBe("basic");
  });
});

describe("a card with nothing in basic reach fires a Special that can land", () => {
  const build = (skill: GameState["aiSkill"]) => {
    const s = battle();
    s.aiSkill = skill;
    const me = place(s, "bolt_thundercat", "P2", 1, 2); // melee; Special charges 2 then strikes 8
    place(s, "leaf_greegon", "P1", 3, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    return { s, id: me.instanceId };
  };

  it("ThunderCat charges in rather than skipping the turn", () => {
    const { s, id } = build("sharp");
    expect(chooseBattleAction(s, id).action).toBe("special");
  });

  it("the learning rung still skips — hoarding its magic is its handicap", () => {
    const { s, id } = build("learning");
    expect(chooseBattleAction(s, id).action).toBe("skip");
  });
});

describe("spells the AI could never choose", () => {
  it("Frost Patch freezes a row of heavy hitters", () => {
    const s = prepWith("aqua_frost_patch", 2);
    place(s, "bore_kobra", "P1", 2, 1, { curHp: 30, maxHp: 30 });
    place(s, "bore_kobra", "P1", 2, 3, { curHp: 30, maxHp: 30 });
    const intent = aiPrepIntent(s, "P2");
    expect(cast(intent, "aqua_frost_patch")).toBe(true);
    if (intent.type === "CAST_SPELL") expect(intent.row).toBe(2);
  });

  it("...and is not spent on two bodies that hit for nothing", () => {
    const s = prepWith("aqua_frost_patch", 2);
    place(s, "bolt_rodd", "P1", 2, 1);
    place(s, "bolt_rodd", "P1", 2, 3);
    expect(cast(aiPrepIntent(s, "P2"), "aqua_frost_patch")).toBe(false);
  });

  it("Sprout mends the row holding the wounded LEAF allies", () => {
    const s = prepWith("leaf_thorn_patch", 2);
    place(s, "leaf_greegon", "P2", 1, 1, { curHp: 2 });
    place(s, "leaf_greegon", "P2", 1, 3, { curHp: 2 });
    const intent = aiPrepIntent(s, "P2");
    expect(cast(intent, "leaf_thorn_patch")).toBe(true);
    if (intent.type === "CAST_SPELL") expect(intent.row).toBe(1);
  });

  it("...and waits while the line is healthy", () => {
    const s = prepWith("leaf_thorn_patch", 2);
    place(s, "leaf_greegon", "P2", 1, 1);
    place(s, "leaf_greegon", "P2", 1, 3);
    expect(cast(aiPrepIntent(s, "P2"), "leaf_thorn_patch")).toBe(false);
  });

  const reconBoard = (casters: number) => {
    const s = prepWith("bolt_recon_ping", 3);
    for (let i = 0; i < casters; i++) {
      place(s, "bolt_thunder", "P2", 1, i * 2); // Special: 2 magic, strike 7 + splash
      place(s, "leaf_greegon", "P1", 2, i * 2, { curHp: 900, maxHp: 900, curShields: 0 });
    }
    return s;
  };

  it("Recon Ping goes out when three Specials can use the discount", () => {
    expect(cast(aiPrepIntent(reconBoard(3), "P2"), "bolt_recon_ping")).toBe(true);
  });

  it("...but not to save one point on a single Special", () => {
    expect(cast(aiPrepIntent(reconBoard(1), "P2"), "bolt_recon_ping")).toBe(false);
  });
});
