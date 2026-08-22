// The eight legends, and the five mechanics they needed built.
//
// Most of what these cards do was already in the engine — vsStatus, onHitByMelee,
// summonSpawn, statusSplash, mounted, alwaysHit. What is tested here is the part
// that was NOT: five new hooks, and the handful of card-level combinations that
// only make sense together (Kobra's Special setting up Kobra's passive, Aranea's
// aura reaching the brood she raises after she lands).
import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { SPECIAL_HANDLERS, basicAttack } from "../combat";
import { boardCards, effectiveDmg, effectiveSp } from "../state";
import { getDef } from "../../data/cards";
import { atCleanup, place, prepState, statusOf } from "./helpers";
import type { CardInstance, GameState } from "../types";

const params = (id: string) => getDef(id).special!.params as Record<string, string | number>;
const ROOT = { kind: "ROOT" as const, duration: 3, power: 0, source: "LEAF" as const };

/** Fire `id`'s Special at `target`, with both boards non-empty. */
function cast(s: GameState, caster: CardInstance, target?: CardInstance) {
  const id = caster.defId;
  SPECIAL_HANDLERS[getDef(id).special!.handler](s, caster, target ? [target] : [], params(id));
}

describe("the eight legends are on the board", () => {
  const IDS = [
    "bolt_havoc", "leaf_snapmaw", "gale_dreamcatcher", "aqua_killerwhale",
    "dawn_lassos", "bore_kobra", "pyro_burnout", "dusk_aranea",
  ] as const;

  it("all eight exist, all legendary, one per element", () => {
    const els = IDS.map((id) => getDef(id).element);
    expect(new Set(els).size, "one per element").toBe(8);
    for (const id of IDS) expect(getDef(id).rarity, id).toBe("legendary");
  });

  it("every stat line sits on the cost budget", () => {
    // state.test.ts already sweeps CARDS for this; stated again here so a tweak
    // to one of these eight fails in the file that is about them.
    for (const id of IDS) {
      const d = getDef(id);
      const total = d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;
      expect(Math.abs(total - (5 * d.cost + 10)), `${id}: ${total}`).toBeLessThanOrEqual(2);
    }
  });
});

describe("Havoc — ThunderShot", () => {
  it("PARALYZEs a clean target and does NOT mute it", () => {
    const s = prepState();
    const havoc = place(s, "bolt_havoc", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    cast(s, havoc, foe);
    expect(statusOf(s.cards[foe.instanceId], "PARALYZE")).toBeDefined();
    expect(statusOf(s.cards[foe.instanceId], "MUTED"), "nothing was on it").toBeUndefined();
  });

  it("MUTEs a target that was ALREADY carrying something", () => {
    const s = prepState();
    const havoc = place(s, "bolt_havoc", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, {
      curHp: 60, maxHp: 60, curShields: 0,
      status: { kind: "BURN", duration: 2, power: 1, source: "PYRO" },
    });
    cast(s, havoc, foe);
    expect(statusOf(s.cards[foe.instanceId], "MUTED")).toBeDefined();
  });

  it("reads the board as the shot FOUND it, not as it left it", () => {
    // The trap: ThunderShot applies PARALYZE itself. If the condition were
    // checked after, every cast would mute — the rider would be unconditional
    // and the card would be lying.
    expect(params("bolt_havoc").statusIfAlready).toBe("MUTED");
    expect(params("bolt_havoc").statusKind).toBe("PARALYZE");
  });

  it("brings Surge with it", () => {
    const s = prepState();
    s.players.P1.gold = 30;
    const hand = `h${s.nextId++}`;
    s.players.P1.hand.push({ handId: hand, defId: "bolt_havoc" });
    place(s, "dusk_gool", "P2", 0, 0);
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: hand, col: 1 } as never);
    expect(boardCards(n, "P1").some((c) => c.defId === "bolt_surge")).toBe(true);
  });
});

describe("Snapmaw — Snare Garden and Devour", () => {
  it("bleeds every ROOTed opponent at end of round, from any source", () => {
    const s = prepState();
    place(s, "leaf_snapmaw", "P1", 3, 0);
    const rooted = place(s, "dusk_gool", "P2", 1, 0, { curHp: 40, maxHp: 40, status: ROOT });
    const free = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    const n = advance(atCleanup(s));
    expect(statusOf(n.cards[rooted.instanceId], "BLEED"), "rooted → bleeding").toBeDefined();
    expect(statusOf(n.cards[free.instanceId], "BLEED"), "free → untouched").toBeUndefined();
  });

  it("the bleed does not stack or carry", () => {
    // Applied at duration 1 so the very next cleanup expires it; a target that
    // stays rooted simply takes 1 again. Two rounds must not leave BLEED 2.
    const s = prepState();
    place(s, "leaf_snapmaw", "P1", 3, 0);
    const rooted = place(s, "dusk_gool", "P2", 1, 0, { curHp: 90, maxHp: 90, status: ROOT });
    let g = advance(atCleanup(s));
    g = advance(atCleanup(g));
    const b = statusOf(g.cards[rooted.instanceId], "BLEED");
    expect(b?.power ?? 0, "still 1, never 2").toBeLessThanOrEqual(1);
  });

  it("Devour refuses a target that is not ROOTed", () => {
    const s = prepState();
    const maw = place(s, "leaf_snapmaw", "P1", 3, 0);
    const free = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    cast(s, maw, free);
    expect(s.cards[free.instanceId].curHp, "untouched").toBe(40);
    expect(s.log.some((l) => /nothing to sink into/.test(l)), "and it says why").toBe(true);
  });

  it("Devour bites a ROOTed one, and grows permanently on the kill", () => {
    const s = prepState();
    const maw = place(s, "leaf_snapmaw", "P1", 3, 0);
    const doomed = place(s, "dusk_gool", "P2", 2, 0, { curHp: 2, maxHp: 40, curShields: 0, status: ROOT });
    const before = effectiveDmg(s, maw);
    cast(s, maw, doomed);
    expect(effectiveDmg(s, s.cards[maw.instanceId]) - before).toBe(2);
  });
});

describe("Dreamcatcher — Dreamweaver", () => {
  it("WEAKENs the HIGHEST-DMG opponent in range, not the weakest", () => {
    // The whole selection: a debuffer that softens whatever is nearly dead is
    // wasting its round.
    const s = prepState();
    place(s, "gale_dreamcatcher", "P1", 2, 1);
    const big = place(s, "bore_kobra", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    const small = place(s, "dusk_spider", "P2", 1, 2, { curHp: 3, maxHp: 3 });
    const n = advance(atCleanup(s));
    expect(effectiveDmg(s, big)).toBeGreaterThan(effectiveDmg(s, small));
    expect(statusOf(n.cards[big.instanceId], "WEAKEN"), "the threat").toBeDefined();
    expect(statusOf(n.cards[small.instanceId], "WEAKEN"), "not the scrap").toBeUndefined();
  });

  it("Soul Snare lands BOTH statuses", () => {
    // statusNova could only ever apply one before this card.
    const s = prepState();
    const dc = place(s, "gale_dreamcatcher", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    cast(s, dc, foe);
    expect(statusOf(s.cards[foe.instanceId], "SLEEP")).toBeDefined();
    expect(statusOf(s.cards[foe.instanceId], "WEAKEN")).toBeDefined();
  });
});

describe("Killer Whale and Kobra hunt what they disable", () => {
  it("Apex Predator adds damage against FROZEN, which Tidal Crush creates", () => {
    const s = prepState();
    const orca = place(s, "aqua_killerwhale", "P1", 2, 1);
    const warm = place(s, "dusk_gool", "P2", 1, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    const cold = place(s, "dusk_gool", "P2", 1, 2, {
      curHp: 90, maxHp: 90, curShields: 0,
      status: { kind: "FREEZE", duration: 2, power: 0, source: "AQUA" },
    });
    basicAttack(s, orca.instanceId, warm.instanceId);
    const plain = 90 - s.cards[warm.instanceId].curHp;
    basicAttack(s, orca.instanceId, cold.instanceId);
    const frozen = 90 - s.cards[cold.instanceId].curHp;
    expect(frozen, "harder into a frozen target").toBeGreaterThan(plain);
  });

  it("Ambush Coil DOUBLES into a SLEEPING target", () => {
    const s = prepState();
    const kobra = place(s, "bore_kobra", "P1", 2, 1);
    const awake = place(s, "dusk_gool", "P2", 1, 1, { curHp: 200, maxHp: 200, curShields: 0 });
    const asleep = place(s, "dusk_gool", "P2", 1, 2, {
      curHp: 200, maxHp: 200, curShields: 0,
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    basicAttack(s, kobra.instanceId, awake.instanceId);
    const plain = 200 - s.cards[awake.instanceId].curHp;
    basicAttack(s, kobra.instanceId, asleep.instanceId);
    expect(200 - s.cards[asleep.instanceId].curHp).toBeGreaterThan(plain);
  });

  it("Kobra is the Assassin it was rebuilt into, and dodges", () => {
    const d = getDef("bore_kobra");
    expect(d.cardClass).toBe("Assassin");
    expect(d.keywords.EVASION).toBe(true);
    expect(d.dmg).toBe(10);
    expect(d.hp).toBe(16);
  });
});

describe("Burnout — Super Charger", () => {
  it("spikes SP for a round after a cast, then gives it back", () => {
    // Through the real BATTLE_ACTION path, not the handler — Super Charger
    // hangs off the CAST, not off Blitzing Ram, so calling the handler direct
    // would skip the very thing under test.
    const s = prepState();
    const burn = place(s, "pyro_burnout", "P1", 3, 1);
    place(s, "dusk_gool", "P2", 1, 1, { curHp: 60, maxHp: 60 });
    const base = effectiveSp(s, burn);
    s.players.P1.magicPool = 20;
    s.cards[burn.instanceId].specialCooldown = 0;
    s.phase = "battle";
    s.prep = null;
    s.battle = { queue: [burn.instanceId], index: 0, awaitingInput: burn.instanceId };
    const n = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special" } as never);
    const revved = effectiveSp(n, n.cards[burn.instanceId]);
    expect(revved - base, "+8 while it is lit").toBe(8);
    const later = advance(atCleanup(n));
    expect(effectiveSp(later, later.cards[burn.instanceId]), "and it settles back").toBe(base);
  });
});

describe("Aranea — Broodmother", () => {
  it("buffs allied Spiders and nothing else", () => {
    const s = prepState();
    place(s, "dusk_aranea", "P1", 3, 0);
    const spider = place(s, "dusk_spider", "P1", 3, 1);
    const notSpider = place(s, "dusk_gool", "P1", 3, 2);
    const enemySpider = place(s, "dusk_spider", "P2", 0, 1);
    expect(effectiveDmg(s, spider) - getDef("dusk_spider").dmg, "her brood").toBe(2);
    expect(effectiveDmg(s, notSpider) - getDef("dusk_gool").dmg, "not the rest").toBe(0);
    expect(effectiveDmg(s, enemySpider) - getDef("dusk_spider").dmg, "not theirs").toBe(0);
  });

  it("does not buff herself", () => {
    const s = prepState();
    const q = place(s, "dusk_aranea", "P1", 3, 0);
    expect(effectiveDmg(s, q)).toBe(getDef("dusk_aranea").dmg);
  });

  it("is RENTED — killing her takes it back from the whole brood", () => {
    // The difference between this and onDeath.allyTribeBuffDmg, and the reason
    // she is the thing to shoot rather than the spiders.
    const s = prepState();
    const q = place(s, "dusk_aranea", "P1", 3, 0);
    const spider = place(s, "dusk_spider", "P1", 3, 1);
    expect(effectiveDmg(s, spider)).toBe(getDef("dusk_spider").dmg + 2);
    s.cards[q.instanceId].curHp = 0;
    expect(effectiveDmg(s, spider), "back to normal").toBe(getDef("dusk_spider").dmg);
  });

  it("Brood Summon raises a Monstrous Spider that bursts into two", () => {
    const s = prepState();
    const q = place(s, "dusk_aranea", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    cast(s, q, foe);
    const brood = boardCards(s, "P1").filter((c) => c.defId === "dusk_monstrous_spider_tok");
    expect(brood, "one monster, not two").toHaveLength(1);
    expect(statusOf(s.cards[foe.instanceId], "FRIGHTEN")).toBeDefined();
    // …and the monster carries her aura too, being a Spider itself.
    // Measured as a DELTA against the same body with no queen out, so an
    // unrelated element aura cannot be mistaken for Broodmother.
    const solo = prepState();
    const lone = place(solo, "dusk_monstrous_spider_tok", "P1", 2, 1);
    place(solo, "dusk_gool", "P2", 1, 1);
    expect(effectiveDmg(s, brood[0]) - effectiveDmg(solo, lone)).toBe(2);
    expect(getDef("dusk_monstrous_spider_tok").onDeath?.spawnToken)
      .toEqual({ token: "dusk_spider", count: 2 });
  });
});

describe("Lassos", () => {
  it("cannot miss, and hits BLINDed targets harder", () => {
    const d = getDef("dawn_lassos");
    expect(d.alwaysHit).toBe(true);
    expect(d.vsStatus).toEqual({ status: "BLIND", bonusDmg: 2 });
    // Hogtie is what puts the BLIND there — the Special sets up the passive.
    expect(params("dawn_lassos").statusKind).toBe("BLIND");
  });

  it("rides in with the horse's HP, and moves like a king", () => {
    const s = prepState();
    s.players.P1.gold = 30;
    const hand = `h${s.nextId++}`;
    s.players.P1.hand.push({ handId: hand, defId: "dawn_lassos" });
    place(s, "dusk_gool", "P2", 0, 0);
    const n = applyIntent(s, { type: "SUMMON", player: "P1", handId: hand, col: 1 } as never);
    const l = boardCards(n, "P1").find((c) => c.defId === "dawn_lassos")!;
    expect(l.maxHp, "16 printed + 12 from the mount").toBe(getDef("dawn_lassos").hp + 12);
    expect(getDef("dawn_lassos").mounted).toBe(true);
  });

  it("is a Star, because DAWN's tribes split by class", () => {
    // A Ranger is a Star. A third DAWN tribe would leave it outside BOTH auras,
    // so its own name rides alongside rather than instead.
    const tribes = getDef("dawn_lassos").tribe;
    expect(Array.isArray(tribes) && tribes.includes("Stars")).toBe(true);
  });
});
