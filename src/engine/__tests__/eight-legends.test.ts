// The eight legends, and the five mechanics they needed built.
//
// Most of what these cards do was already in the engine — vsStatus, onHitByMelee,
// summonSpawn, statusSplash, mounted, alwaysHit. What is tested here is the part
// that was NOT: five new hooks, and the handful of card-level combinations that
// only make sense together (Kobra's Special setting up Kobra's passive, Aranea's
// aura reaching the brood she raises after she lands).
import { describe, expect, it } from "vitest";
import { advance, applyIntent } from "../phases";
import { canFireSpecial, canMove, specialTargets, validSpecialTargets, validTargets } from "../rules";
import { SPECIAL_HANDLERS, basicAttack, defeatCard } from "../combat";
import { boardCards, effectiveDmg, effectiveSp } from "../state";
import { getDef } from "../../data/cards";
import { atCleanup, giveHand, place, prepState, statusOf } from "./helpers";
import type { CardInstance, GameState } from "../types";

/** Hand the battle queue one card and wait on it, so a Special can be cast
 *  directly. Same shape as the helper in mythics/legendaries. */
function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

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

  it("every stat line sits on the cost budget — except the ones that buy a body", () => {
    // state.test.ts already sweeps CARDS for this; stated again here so a tweak
    // to one of these eight fails in the file that is about them.
    //
    // The two skips are the same design, not two separate excuses: both spawn a
    // REAL card on summon, and both pay for it out of their own stat line. Each
    // is asserted properly in its own test below rather than merely waved past.
    const BUYS_A_BODY = new Set(["bolt_havoc", "bore_kobra"]);
    for (const id of IDS) {
      if (BUYS_A_BODY.has(id)) continue;
      const d = getDef(id);
      const total = d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;
      expect(Math.abs(total - (5 * d.cost + 10)), `${id}: ${total}`).toBeLessThanOrEqual(2);
    }
  });

  it("Kobra is under budget BECAUSE it brings the King Cobra", () => {
    // Computed, not remembered — the equivalent note in state.test.ts warns
    // that this kind of entry has been silently wrong before, quoting figures
    // for a card that was actually inside the band.
    const k = getDef("bore_kobra");
    const tok = getDef("bore_kingcobra_tok");
    const body = (d: typeof k) => d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;
    expect(body(k), "Kobra's own line").toBe(41);
    expect(5 * k.cost + 10, "the Cost-7 budget it is measured against").toBe(45);
    // 31 -> 25: the King Cobra was promoted from a TOKEN to a draftable cost-3
    // Rare and restatted to that budget, so Kobra's free body is six points
    // smaller than when this discount was written. Still comfortably more
    // than the four points off Kobra's own line.
    expect(body(tok), "and the free snake beside it").toBe(25);
    // The discount is real but small; the RECOST is what pays for the token.
    expect(5 * k.cost + 10 - body(k), "four points under").toBe(4);
    expect(k.summonSpawn?.token).toBe("bore_kingcobra_tok");
  });

  it("Havoc is under budget BECAUSE it brings Surge", () => {
    // The exception is the design, so it is asserted rather than merely skipped:
    // Running Crew summons a real cost-4 CARD, and the day someone deletes that
    // line this test should be what objects — not a stat sweep that has quietly
    // been passing an 11-point hole for months.
    const havoc = getDef("bolt_havoc");
    const body = (d: typeof havoc) => d.dmg * d.hits + d.hp + d.shields * 2 + d.sp;
    const gap = 5 * havoc.cost + 10 - body(havoc);
    expect(gap, "deliberately under-statted").toBeGreaterThan(2);
    expect(havoc.summonSpawn?.token, "and this is what pays for it").toBe("bolt_surge");
    expect(body(getDef("bolt_surge")), "a body worth more than the gap").toBeGreaterThan(gap);
  });
});

describe("the two growth engines are bounded", () => {
  // Both were found by reading rather than by measurement, which is the pattern
  // the balance notes record: "no card was found to be measurably overpowered —
  // the real finds were design flaws that measurement never surfaced." Neither
  // of these showed up as a win-rate outlier; both are numbers that only ever
  // go up, on cards that create their own opportunities to raise them.

  it("Devour's permanent DMG stops at +6", () => {
    const s = prepState();
    // Roomy HP: the victims must die to Devour, not kill Snapmaw on the way out
    // (Gool's death-lash was quietly finishing it before the sixth meal).
    const snap = place(s, "leaf_snapmaw", "P1", 3, 0, { curHp: 999, maxHp: 999 });
    const def = getDef("leaf_snapmaw").special!;
    // Six ROOTed victims, each in its own slot — the bonus must stall at the
    // cap, not at the number of kills. Devour ignores the Home rule, so any
    // enemy square is reachable.
    for (let i = 0; i < 6; i++) {
      const prey = place(s, "leaf_alpha", "P2", (i < 3 ? 1 : 2) as never, (i % 3) as never, {
        curHp: 1, maxHp: 1, curShields: 0,
        status: { kind: "ROOT", duration: 3, power: 0, source: "LEAF" },
      });
      // BARRAGE, which is the handler the card actually declares. This called
      // `strike` and kept passing after Devour moved off it — strike ignores
      // `targets` and bites `targets[0]`, so a one-victim board looked
      // identical either way and the growth rider it was testing was being
      // read out of the wrong function.
      SPECIAL_HANDLERS[def.handler](s, s.cards[snap.instanceId], [prey], def.params!);
      expect(s.cards[prey.instanceId], `victim ${i} was devoured`).toBeUndefined();
    }
    expect(s.cards[snap.instanceId].dmgBonus, "capped").toBe(6);
  });

  it("...and the cap is declared on the card, not buried in the handler", () => {
    expect(getDef("leaf_snapmaw").special!.params!.onKillSelfDmgMax).toBe(6);
  });

  it("Aranea's brood stops at two Monstrous Spiders", () => {
    const s = prepState();
    const aranea = place(s, "dusk_aranea", "P1", 3, 0);
    const def = getDef("dusk_aranea").special!;
    const brood = () => boardCards(s, "P1")
      .filter((c) => c.curHp > 0 && c.defId === "dusk_monstrous_spider_tok").length;
    for (let i = 0; i < 5; i++)
      SPECIAL_HANDLERS.statusNova(s, s.cards[aranea.instanceId], [], def.params!);
    expect(brood(), "capped").toBe(2);
  });

  it("...and it is a STOCK — clearing the brood re-arms the summon", () => {
    // The distinction that keeps "AoE the swarm" an answer: a per-game
    // allowance would mean waiting it out beats clearing it.
    const s = prepState();
    const aranea = place(s, "dusk_aranea", "P1", 3, 0);
    const def = getDef("dusk_aranea").special!;
    const brood = () => boardCards(s, "P1")
      .filter((c) => c.curHp > 0 && c.defId === "dusk_monstrous_spider_tok");
    for (let i = 0; i < 3; i++)
      SPECIAL_HANDLERS.statusNova(s, s.cards[aranea.instanceId], [], def.params!);
    expect(brood()).toHaveLength(2);
    defeatCard(s, brood()[0], "test");
    SPECIAL_HANDLERS.statusNova(s, s.cards[aranea.instanceId], [], def.params!);
    expect(brood(), "the gap is refilled").toHaveLength(2);
  });
});

describe("Killer Whale — Breach", () => {
  // A cost-7 body that needed a whole turn and 3 magic before it did anything,
  // on the element that measured last for most of its life.

  it("Tidal Crush fires the moment it lands", () => {
    const s = prepState(42, "P2");
    const prey = place(s, "leaf_alpha", "P1", 1, 1, { curHp: 99, maxHp: 99, curShields: 0 });
    s.players.P2.gold = 30;
    s.players.P2.magicPool = 0;          // free: no magic, and none is spent
    const handId = giveHand(s, "P2", "aqua_killerwhale");
    const n = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 1 } as never);
    expect(n.players.P2.magicPool, "not a penny").toBe(0);
    const hurt = boardCards(n, "P1").find((c) => c.instanceId === prey.instanceId)!;
    expect(hurt.curHp, "the row ahead took it").toBeLessThan(99);
    expect(hurt.statuses.map((x) => x.kind), "and froze").toContain("FREEZE");
  });

  it("is declared as the flag, not as a second copy of the Special", () => {
    // The obvious way to write this is to paste the Special's handler and
    // params into `onSummon`, and it is the wrong way: two descriptions of one
    // effect drift the first time the Special is retuned, and the card then
    // does something its own printed text no longer says.
    const os = getDef("aqua_killerwhale").onSummon!;
    expect(os.castsOwnSpecial).toBe(true);
    expect(os.handler, "no duplicated handler").toBeUndefined();
    expect(os.params, "no duplicated params").toBeUndefined();
  });

  it("still costs magic when cast the ordinary way", () => {
    // Free ON SUMMON only. If the arrival cast made the Special free
    // thereafter, the card would be casting a 3-magic board wipe every cooldown
    // for nothing.
    const s = prepState(42, "P2");
    const kw = place(s, "aqua_killerwhale", "P2", 0, 1);
    place(s, "leaf_alpha", "P1", 1, 1, { curHp: 99, maxHp: 99 });
    s.players.P2.magicPool = 10;
    kw.specialCooldown = 0;
    const before = s.players.P2.magicPool;
    const r = canFireSpecial(s, kw.instanceId);
    expect(r.ok, "castable").toBe(true);
    expect(before, "and the pool is what pays for it").toBe(10);
  });
});

describe("a charge that kills takes the ground", () => {
  // Both specials already close the distance; both used to stop one slot short
  // of the thing they had just deleted and stand there, which reads as the
  // charge halting politely at the door.

  const kill = (id: string, from: [number, number], at: [number, number]) => {
    const s = prepState();
    const me = place(s, id, "P1", from[0] as never, from[1] as never);
    const prey = place(s, "leaf_alpha", "P2", at[0] as never, at[1] as never,
      { curHp: 1, maxHp: 1, curShields: 0 });
    SPECIAL_HANDLERS.strike(s, s.cards[me.instanceId], [prey], getDef(id).special!.params!);
    return { s, me: s.cards[me.instanceId], gone: s.cards[prey.instanceId] === undefined };
  };

  it("Burnout ends the crash standing where its target was", () => {
    const r = kill("pyro_burnout", [3, 1], [1, 1]);
    expect(r.gone, "the target died").toBe(true);
    expect(r.me.pos).toEqual({ row: 1, col: 1 });
  });

  it("Skyrend lands on the perch it cleared", () => {
    const r = kill("gale_griffith", [3, 0], [1, 2]);
    expect(r.gone).toBe(true);
    expect(r.me.pos).toEqual({ row: 1, col: 2 });
  });

  it("a target that SURVIVES is not vacated — the ram stops where it stopped", () => {
    const s = prepState();
    const me = place(s, "pyro_burnout", "P1", 3, 1);
    const prey = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 999, maxHp: 999 });
    SPECIAL_HANDLERS.strike(s, s.cards[me.instanceId], [prey],
      getDef("pyro_burnout").special!.params!);
    expect(s.cards[prey.instanceId].pos, "still standing there").toEqual({ row: 1, col: 1 });
    expect(s.cards[me.instanceId].pos).not.toEqual({ row: 1, col: 1 });
  });

  it("will not step onto a CAPTURED slot, even one it just emptied", () => {
    // A captured slot is off limits to everyone, permanently. Walking a ram
    // into one would put a body somewhere no body may stand.
    const s = prepState();
    const me = place(s, "pyro_burnout", "P1", 3, 1);
    const prey = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 1, maxHp: 1, curShields: 0 });
    s.slots[1][1].capturedBy = "P2";
    SPECIAL_HANDLERS.strike(s, s.cards[me.instanceId], [prey],
      getDef("pyro_burnout").special!.params!);
    expect(s.cards[prey.instanceId], "the kill still happened").toBeUndefined();
    expect(s.cards[me.instanceId].pos, "but it stayed out").not.toEqual({ row: 1, col: 1 });
  });

  it("Tempest ends the cyclone standing where its target was", () => {
    // Same column: Cyclone Strike has `chargeFirst` without `chargeLateral`, so
    // the approach is `chargeForward` — straight up its own file.
    const r = kill("gale_tempest", [3, 1], [1, 1]);
    expect(r.gone, "the target died").toBe(true);
    expect(r.me.pos).toEqual({ row: 1, col: 1 });
  });

  it("...and does not move when Cyclone Strike leaves the target alive", () => {
    // The control for the case above. `takeSpotOnKill` is gated on the KILL, not
    // on the cast, and a Special that repositions either way is a different card.
    const s = prepState();
    const me = place(s, "gale_tempest", "P1", 3, 1);
    const prey = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 999, maxHp: 999 });
    SPECIAL_HANDLERS.strike(s, s.cards[me.instanceId], [prey],
      getDef("gale_tempest").special!.params!);
    expect(s.cards[prey.instanceId].pos, "still standing there").toEqual({ row: 1, col: 1 });
    expect(s.cards[me.instanceId].pos, "and Tempest is not on top of it").not.toEqual({ row: 1, col: 1 });
  });

  it("...and Cyclone Strike says so on the card", () => {
    // The rider has no renderer — `describePassives` never sees a Special's
    // params — so the only place a player can read it is the hand-written text.
    // Every other carrier states it (Dive Bomb, Solar Pounce, Maul); this is
    // what stops the param and the promise drifting apart.
    const sp = getDef("gale_tempest").special!;
    expect(sp.params!.takeSpotOnKill).toBe(1);
    expect(sp.text.toLowerCase()).toContain("in its place");
  });

  it("Burnout charges three slots now, not two", () => {
    expect(getDef("pyro_burnout").special!.params!.charge).toBe(3);
  });
});

describe("Burnout — King of the Streets", () => {
  it("every kill is permanently +1 DMG and +1 SP", () => {
    const s = prepState();
    const burn = place(s, "pyro_burnout", "P1", 3, 0);
    const prey = place(s, "dusk_gool", "P2", 3, 1, { curHp: 1, maxHp: 1, curShields: 0 });
    basicAttack(s, burn.instanceId, prey.instanceId);
    const b = s.cards[burn.instanceId];
    expect(b.dmgBonus).toBe(1);
    expect(b.spBonus).toBe(1);
  });

  it("it stacks, the way Sapphire's Vaporizer does", () => {
    // Uncapped on purpose, and the reason is the distinction from Snapmaw
    // above: these are kills you had to go and get with a melee body in
    // contested combat, not prey the card rooted for itself.
    const s = prepState();
    const burn = place(s, "pyro_burnout", "P1", 3, 0);
    for (const col of [1, 2]) {
    // BORE, not DUSK: Midnight Shade gives DUSK cards dodge per FALLEN DUSK
    // ally, so the first kill armed the second body and this assertion rode a
    // coin on the shared RNG stream. The victim's element is incidental here.
      const prey = place(s, "bore_rockgoblin", "P2", 3, col, { curHp: 1, maxHp: 1, curShields: 0 });
      basicAttack(s, burn.instanceId, prey.instanceId);
    }
    expect(s.cards[burn.instanceId].dmgBonus).toBe(2);
    expect(s.cards[burn.instanceId].spBonus).toBe(2);
  });

  it("is named on the card, so the inspector explains it", () => {
    expect(getDef("pyro_burnout").passiveNames?.onKill).toBe("King of the Streets");
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

  // Devour used to be a `strike` that took one target and REFUSED it out loud
  // when it was not ROOTed. As a barrage it never gets that far: `requireStatus`
  // runs in `volleyFilters`, which feeds the preview and `canFireSpecial` too,
  // so an unrooted board leaves the Special with no legal target and it cannot
  // be cast at all. Same promise — the magic is never spent for nothing — kept
  // one step earlier, where the player finds out before paying rather than
  // after.
  it("Devour cannot even be fired when nothing is ROOTed", () => {
    const s = prepState();
    const maw = place(s, "leaf_snapmaw", "P1", 3, 0);
    const free = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    s.players.P1.magicPool = 9;
    expect(specialTargets(s, maw.instanceId), "no ROOTed body, no target").toEqual([]);
    expect(canFireSpecial(s, maw.instanceId).ok, "so the button is dead").toBe(false);
    expect(s.cards[free.instanceId].curHp, "and nothing is touched").toBe(40);
  });

  it("...and bites EVERY ROOTed body at once, for 4 each", () => {
    const s = prepState();
    const maw = place(s, "leaf_snapmaw", "P1", 3, 0);
    s.players.P1.magicPool = 9;
    const rooted = [0, 1, 2].map((c) =>
      place(s, "dusk_gool", "P2", 1, c as never,
        { curHp: 40, maxHp: 40, curShields: 0, status: { kind: "ROOT", duration: 3, power: 0, source: "LEAF" } }));
    const loose = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const def = getDef("leaf_snapmaw").special!;
    SPECIAL_HANDLERS[def.handler](s, s.cards[maw.instanceId],
      rooted.map((r) => s.cards[r.instanceId]), def.params!);
    for (const r of rooted) expect(40 - s.cards[r.instanceId].curHp, "each snared body").toBe(4);
    expect(s.cards[loose.instanceId].curHp, "the loose one is not in the snare").toBe(40);
  });

  it("reaches ANY rooted opponent, the enemy home row included", () => {
    // Ordinary targeting keeps the defender's home row off-limits from your own
    // back line — that rule is what protects the capture race. Devour is exempt,
    // and the exemption is scoped to the SPECIAL: the basic still respects it,
    // and having spent a root on the target is what pays for the reach.
    const s = prepState(1, "P1");
    const maw = place(s, "leaf_snapmaw", "P1", 3, 0);      // its own home row
    const inHome = place(s, "dusk_gool", "P2", 0, 3, { status: ROOT }); // theirs
    const ids = validSpecialTargets(s, maw.instanceId).map((c) => c.instanceId);
    expect(ids, "the Special reaches").toContain(inHome.instanceId);
    // …and the basic does not, which is the half that keeps this a Special.
    const basicIds = validTargets(s, maw.instanceId).map((c) => c.instanceId);
    expect(basicIds, "the basic still obeys the home rule").not.toContain(inHome.instanceId);
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

  it("the King Cobra it raises hunts the same way", () => {
    // Venom Strike sleeps a target and then BOTH snakes hit it for double —
    // which is what makes the spawn a hunting partner rather than a spare body.
    const s = prepState();
    const cobra = place(s, "bore_kingcobra_tok", "P1", 2, 1);
    const awake = place(s, "dusk_gool", "P2", 1, 1, { curHp: 200, maxHp: 200, curShields: 0 });
    const asleep = place(s, "dusk_gool", "P2", 1, 2, {
      curHp: 200, maxHp: 200, curShields: 0,
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    basicAttack(s, cobra.instanceId, awake.instanceId);
    const plain = 200 - s.cards[awake.instanceId].curHp;
    basicAttack(s, cobra.instanceId, asleep.instanceId);
    expect(200 - s.cards[asleep.instanceId].curHp).toBeGreaterThan(plain);
    // Written on the snake, not lent by its parent — it keeps hunting after the
    // Kobra is gone.
    expect(getDef("bore_kingcobra_tok").vsStatus)
      .toEqual(getDef("bore_kobra").vsStatus);
  });

  it("and makes its own openings — a 30% bite that sleeps", () => {
    // The loop closing on itself: it can put a target under and then double into
    // it next swing, without needing Venom Strike to have gone first.
    const rider = getDef("bore_kingcobra_tok").onHitStatus!;
    expect(rider.kind).toBe("SLEEP");
    expect(rider.duration).toBe(2);
    expect(rider.chance).toBe(30);

    // And it really fires — roughly a third of landed basics, never all of them.
    // A wide seed sweep rather than one roll, so this measures the rate and not
    // whichever way a single coin happened to land.
    let slept = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const s = prepState(i * 7 + 1);
      const cobra = place(s, "bore_kingcobra_tok", "P1", 2, 1);
      const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 400, maxHp: 400, curShields: 0 });
      basicAttack(s, cobra.instanceId, foe.instanceId);
      if (statusOf(s.cards[foe.instanceId], "SLEEP")) slept++;
    }
    expect(slept, `slept on ${slept}/${n}`).toBeGreaterThan(n * 0.15);
    expect(slept, "a chance, not a lock").toBeLessThan(n * 0.5);
  });

  it("Kobra is the Assassin it was rebuilt into, and dodges", () => {
    const d = getDef("bore_kobra");
    expect(d.cardClass).toBe("Assassin");
    expect(d.keywords.EVASION).toBe(true);
    expect(d.dmg).toBe(10);
    // Cost 7 after the recost, and the HP was TRIMMED rather than raised to the
    // new ceiling — the extra gold pays for the King Cobra, so handing back a
    // bigger body as well would be charging for the token twice and delivering
    // it once. The speed is where the cost went: SP 10 -> 12, so the Assassin
    // gets to the sleeping target first.
    expect(d.cost).toBe(7);
    expect(d.hp).toBe(15);
    expect(d.sp).toBe(12);
  });
});

describe("Burnout — Super Charger", () => {
  it("spikes SP for a round after a cast, then gives it back", () => {
    // Through the real BATTLE_ACTION path, not the handler — Super Charger
    // hangs off the CAST, not off Crash Out, so calling the handler direct
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
    // TWO rounds. At one it was spent almost entirely on the cast's own charge,
    // which Crash Out already pays for — the second round is the difference
    // between a longer ram and a genuine repositioning.
    const r1 = advance(atCleanup(n));
    expect(effectiveSp(r1, r1.cards[burn.instanceId]) - base, "still lit a round later").toBe(8);
    const r2 = advance(atCleanup(r1));
    expect(effectiveSp(r2, r2.cards[burn.instanceId]), "and then it settles back").toBe(base);
  });
});

describe("Burnout — Crash Out", () => {
  it("charges TOWARD the target, not straight ahead", () => {
    // chargeForward walks it at the enemy home row whatever it aimed at, so a
    // target off to one side was rammed from wherever Burnout happened to stop
    // — the charge and the crash pointed different ways.
    const s = prepState();
    const burn = place(s, "pyro_burnout", "P1", 3, 0);
    // Off to the side AND ahead, so "forward" and "toward" are different moves.
    const foe = place(s, "dusk_gool", "P2", 1, 3, { curHp: 90, maxHp: 90, curShields: 0 });
    const from = { ...burn.pos! };
    cast(s, burn, foe);
    const to = s.cards[burn.instanceId].pos!;
    expect(to, "it moved").not.toEqual(from);
    // Closer to the target on the COLUMN axis is the whole point — a pure
    // forward charge cannot change the column at all.
    expect(Math.abs(to.col - foe.pos!.col), "closed the lateral gap")
      .toBeLessThan(Math.abs(from.col - foe.pos!.col));
  });

  it("still burns everything touching the impact", () => {
    const s = prepState();
    const burn = place(s, "pyro_burnout", "P1", 3, 1);
    const target = place(s, "dusk_gool", "P2", 1, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    const beside = place(s, "dusk_gool", "P2", 1, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    cast(s, burn, target);
    expect(statusOf(s.cards[target.instanceId], "BURN"), "the target").toBeDefined();
    expect(statusOf(s.cards[beside.instanceId], "BURN"), "and what it touches").toBeDefined();
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

  it("the FRIGHTEN survives to the Prep it is supposed to freeze", () => {
    // The whole bug, reported as "spiders don't fright". FRIGHTEN does two
    // things — retreats the target a slot when applied, and stops it MOVING in
    // Prep. The cast lands in BATTLE and Cleanup runs straight after, so at
    // duration 1 the status expired before the Prep it existed to freeze: the
    // retreat fired and the fear never did. Asserted through the real phase
    // driver, because the whole failure was an interaction with Cleanup that a
    // direct handler call cannot see.
    const s = prepState();
    const q = place(s, "dusk_aranea", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    cast(s, q, foe);
    expect(statusOf(s.cards[foe.instanceId], "FRIGHTEN"), "applied").toBeDefined();
    const n = advance(atCleanup(s));
    expect(statusOf(n.cards[foe.instanceId], "FRIGHTEN"), "and still there next round").toBeDefined();
    // …which is the half that actually does something: a frightened card cannot move.
    const frightened = n.cards[foe.instanceId];
    n.phase = "prep";
    n.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
    expect(canMove(n, "P2", frightened.instanceId, { row: 2, col: 2 }).ok, "pinned by fear").toBe(false);
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

  it("ropes a target in from ANY direction, not just up the board", () => {
    // Hogtie used `pull`, which drags toward the caster's HOME ROW along the
    // TARGET'S OWN COLUMN — the wrong axis for a rope. Anything off to one side
    // was hauled up the board and ended no nearer Lassos than it started, and a
    // target level with it or behind it could not be pulled toward it at all.
    // `pullToCaster` closes both axes (see reelToCaster).
    const rope = (vr: number, vc: number) => {
      const s = prepState();
      s.players.P1.magicPool = 8;
      const lasso = place(s, "dawn_lassos", "P1", 2, 1, { autoMode: "manual" });
      const foe = place(s, "dusk_gool", "P2", vr, vc, { curHp: 60, maxHp: 60, curShields: 0 });
      const n = applyIntent(battleWith(s, lasso.instanceId), {
        type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
      } as never);
      return n.cards[foe.instanceId].pos!;
    };
    const near = (p: { row: number; col: number }) =>
      Math.max(Math.abs(p.row - 2), Math.abs(p.col - 1));

    // Every direction ends CLOSER to Lassos than it started.
    expect(near(rope(0, 1)), "straight ahead").toBeLessThan(2);
    expect(near(rope(0, 3)), "diagonally off to the side").toBeLessThan(2);
    expect(near(rope(2, 3)), "level with it — the case `pull` could not do").toBeLessThan(2);
    expect(near(rope(3, 3)), "and from behind").toBeLessThan(2);
  });

  it("reels in, it does not drag through — it stops beside the roper", () => {
    const s = prepState();
    s.players.P1.magicPool = 8;
    const lasso = place(s, "dawn_lassos", "P1", 2, 1, { autoMode: "manual" });
    const foe = place(s, "dusk_gool", "P2", 2, 2, { curHp: 60, maxHp: 60, curShields: 0 });
    const n = applyIntent(battleWith(s, lasso.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    } as never);
    expect(n.cards[foe.instanceId].pos, "already adjacent — it stays put").toEqual({ row: 2, col: 2 });
  });

  it("is a SUN, the one-off against DAWN's class split", () => {
    // DAWN splits by class and a Ranger is a Star — Lassos is the exception, and
    // the mount is what earns it: a rider takes Equestrian's shield and HP over
    // Aurora's speed. Registered in `CLASS_RULE_EXCEPTIONS` (auras.test.ts) so
    // the rule still catches an untagged newcomer, which is what it is for.
    //
    // ONE tribe now, not a list. "Sun's Army" rode alongside as flavour shared
    // with the Golden Bull this card ropes, and nothing ever read it — DAWN's
    // only tribe aura matches "Suns" — so it bought nothing while keeping the
    // card out of the tribe that pays.
    expect(getDef("dawn_lassos").tribe).toBe("Suns");
  });
});
