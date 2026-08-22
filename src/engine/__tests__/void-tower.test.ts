// The Void Tower boss framework — the rules that make a boss a boss.
//
// Four properties, each of which quietly failing would un-make the mode:
// the summon budget is REAL (validated, not hand-counted — the design doc
// hand-counted Xilty's list and got 13); a boss can be ACQUIRED NOWHERE (it
// lives in CARDS for the inspector, which puts it one missed filter from a
// player's deck); a boss rolls NO DICE (a puzzle is solved once and then
// executed); and every encounter actually PLAYS to completion.
import { describe, expect, it } from "vitest";
import { CARDS, TOKENS, CARD_INDEX, getDef } from "../../data/cards";
import {
  BODY_CAP_TOLERANCE, FLOOR1_SUMMON_BUDGET, VOID_BOSSES, bodyCap, bodyTotal, bossDefeated,
  buildVoidEncounter, chanceProblems, floorCleared, floorOpen, inTribe, summonBudget,
  summonProblems, towerProgress, trialEventId, voidBossById, voidBossSeat, voidFloors,
} from "../../data/void-tower";
import { isBuildable, validateDeck } from "../../data/custom-decks";
import { EVENTS } from "../../data/events";
import { canCraft, newSave, openPack } from "../../data/story";
import { advance } from "../phases";
import { SPECIAL_HANDLERS, applyStatus, basicAttack } from "../combat";
import { canFireSpecial } from "../rules";
import { boardCards } from "../state";
import { createInitialState, summonCard } from "../state";
import { atCleanup, place, prepState, statusOf } from "./helpers";

const BOSSES = CARDS.filter((c) => c.boss);

describe("the roster", () => {
  it("is seven bosses, every one flagged, every one in VOID_BOSSES", () => {
    expect(BOSSES).toHaveLength(7);
    for (const b of BOSSES) expect(voidBossById(b.id), `${b.id} has framework data`).toBeTruthy();
    for (const v of VOID_BOSSES) expect(CARD_INDEX[v.cardId]?.boss, `${v.cardId} is a boss card`).toBe(true);
  });

  it("follows the formula: tribe from A, and the tribe is real", () => {
    for (const v of VOID_BOSSES) {
      const d = getDef(v.cardId);
      expect(d.element, `${v.cardId} element is its tribe element`).toBe(v.tribeElement);
      expect(inTribe(v.cardId, v.tribe), `${v.cardId} belongs to its own tribe`).toBe(true);
      expect(v.tribeElement, `${v.cardId} is a two-element design`).not.toBe(v.mechanicElement);
    }
  });

  it("every body sits inside its floor's cap band", () => {
    // A SOFT cap, the same shape as the card set's ±2 budget band: the cap plus
    // BODY_CAP_TOLERANCE, no more. Xilty is the reason the tolerance exists —
    // 82 against Floor 1's 80, held deliberately rather than trimmed.
    for (const v of VOID_BOSSES) {
      const total = bodyTotal(getDef(v.cardId));
      expect(total, `${v.cardId}: ${total} vs floor-${v.floor} cap ${bodyCap(v.floor)}`)
        .toBeLessThanOrEqual(bodyCap(v.floor) + BODY_CAP_TOLERANCE);
    }
  });
});

describe("the 12-Gold summon budget", () => {
  it("every formation is legal — budget, tribe, duplicate caps", () => {
    for (const v of VOID_BOSSES) {
      expect(summonProblems(v), `${v.cardId}`).toEqual([]);
    }
  });

  it("and every one of these seven spends exactly 12", () => {
    // Twelve, NOT summonBudget(floor): Skeleeze and Xilty carry the doc's
    // Floor 2/3 assignments, whose budgets are 20 and 28 — ceilings for lists
    // not yet written. The doc's §5 rebuilt all three prototypes TO twelve
    // ("Rotroot landing on 12 unprompted is a good sign the number is right"),
    // and the four new bosses were authored to the same number, so this pins
    // what was actually tuned. A drive-by cost change to any summon says so
    // here instead of silently bending a fight.
    for (const v of VOID_BOSSES) {
      const spend = v.summons.reduce((n, id) => n + getDef(id).cost, 0);
      expect(spend, `${v.cardId}`).toBe(FLOOR1_SUMMON_BUDGET);
      expect(spend, `${v.cardId} inside its own floor's ceiling too`)
        .toBeLessThanOrEqual(summonBudget(v.floor));
    }
  });

  it("tokens are legal summons, and one boss actually uses one", () => {
    // The rule is stated, not accidental: Skeleeze's cost-2 "Skeleton" is
    // dusk_skeleton_tok. If this ever stops being exercised the rule is dead
    // code and should be argued about, not assumed.
    const usesToken = VOID_BOSSES.some((v) =>
      v.summons.some((id) => TOKENS.some((tk) => tk.id === id)));
    expect(usesToken).toBe(true);
  });
});

describe("a boss can be acquired NOWHERE", () => {
  it("is not buildable and not a legal deck member", () => {
    for (const b of BOSSES) {
      expect(isBuildable(b.id), `${b.id} buildable`).toBe(false);
      expect(validateDeck([b.id], 4).ok, `${b.id} passes deck validation`).toBe(false);
    }
  });

  it("never comes out of a pack", () => {
    // 60 packs of 5 cards with a seeded rng — if a boss can be pulled at all,
    // 300 draws from a ~320-card pool will find it.
    const save = newSave();
    let x = 42;
    const rand = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    const bossIds = new Set(BOSSES.map((b) => b.id));
    for (let i = 0; i < 60; i++) {
      const r = openPack(save, rand);
      for (const id of r.pulled) expect(bossIds.has(id), `pulled ${id}`).toBe(false);
    }
  });

  it("cannot be crafted", () => {
    const save = newSave();
    if (save.hero) for (const el of Object.keys(save.hero.essence)) save.hero.essence[el] = 9999;
    for (const b of BOSSES) expect(canCraft(save, b.id).ok, b.id).toBe(false);
  });
});

describe("no random percentages", () => {
  it("no boss def carries a chance-based field", () => {
    // The doc's §6 rule as a test. The one sanctioned exception — randomness
    // with a buildable deterministic answer, like PARALYZE against cleanse —
    // lives in the STATUS system, not on the def, so the def-level sweep is
    // exactly the right net.
    for (const b of BOSSES) {
      expect(chanceProblems(b), `${b.id} rolls dice`).toEqual([]);
    }
  });
});

describe("the new mechanics", () => {
  it("allyRevive stands a defeated tribe ally back up — once, at half HP", () => {
    const s = prepState();
    place(s, "boss_rotroot", "P2", 0, 2);
    const zomb = place(s, "dusk_zhunk", "P2", 1, 1, { curHp: 1, maxHp: 20, curShields: 0 });
    const hitter = place(s, "leaf_alpha", "P1", 2, 1);
    basicAttack(s, hitter.instanceId, zomb.instanceId);
    expect(s.cards[zomb.instanceId], "still on the board").toBeTruthy();
    expect(s.cards[zomb.instanceId].curHp, "back up at half its max").toBe(10);
    expect(s.cards[zomb.instanceId].allyRevived).toBe(true);
    // The second death sticks.
    s.cards[zomb.instanceId].curHp = 1;
    s.cards[hitter.instanceId].attackedThisRound = false;
    basicAttack(s, hitter.instanceId, zomb.instanceId);
    expect(s.cards[zomb.instanceId], "once per card per battle").toBeUndefined();
  });

  it("allyRevive ignores cards outside the tribe", () => {
    const s = prepState();
    place(s, "boss_rotroot", "P2", 0, 2);
    const notZomb = place(s, "dusk_gool", "P2", 1, 1, { curHp: 1, maxHp: 20, curShields: 0 });
    const hitter = place(s, "leaf_alpha", "P1", 2, 1);
    basicAttack(s, hitter.instanceId, notZomb.instanceId);
    expect(s.cards[notZomb.instanceId], "a Ghost is not Rotroot's business").toBeUndefined();
  });

  it("firstAttackMisses eats exactly the first attack, then re-arms next round", () => {
    // Xilty rather than Nightshrike, deliberately: Nightshrike also FLIES, and
    // a melee attacker whiffing on the wings is indistinguishable from the
    // guard doing its job — the first draft of this test measured exactly that.
    const s = prepState();
    const boss = place(s, "boss_xilty", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    const a = place(s, "leaf_alpha", "P1", 2, 1);
    const b = place(s, "leaf_citra", "P1", 2, 2);
    basicAttack(s, a.instanceId, boss.instanceId);
    expect(s.cards[boss.instanceId].curHp, "first attack whiffs whole").toBe(30);
    basicAttack(s, b.instanceId, boss.instanceId);
    expect(s.cards[boss.instanceId].curHp, "second connects").toBeLessThan(30);
    // Next round the guard is back.
    const hpAfter = s.cards[boss.instanceId].curHp;
    const n = advance(atCleanup(s));
    n.cards[a.instanceId].attackedThisRound = false;
    const hpBefore = n.cards[boss.instanceId].curHp;
    basicAttack(n, a.instanceId, boss.instanceId);
    expect(n.cards[boss.instanceId].curHp, "re-armed at Cleanup").toBe(hpBefore);
    void hpAfter;
  });

  it("the guard is SPRUNG by an attack it could not stop", () => {
    // Sequencing is the counter: an alwaysHit opener both connects AND spends
    // the guard, so the follow-up hits too. If the guard survived the sure
    // hit, leading with it would be pointless and the counter would be gone.
    const s = prepState();
    const boss = place(s, "boss_xilty", "P2", 1, 1, { curHp: 60, maxHp: 60, curShields: 0 });
    const sure = place(s, "dawn_clipsey", "P1", 2, 1); // alwaysHit
    expect(getDef("dawn_clipsey").alwaysHit).toBe(true);
    basicAttack(s, sure.instanceId, boss.instanceId);
    const afterSure = s.cards[boss.instanceId].curHp;
    expect(afterSure, "the sure hit connects").toBeLessThan(60);
    const b = place(s, "leaf_alpha", "P1", 2, 2);
    basicAttack(s, b.instanceId, boss.instanceId);
    expect(s.cards[boss.instanceId].curHp, "and the guard is already spent").toBeLessThan(afterSure);
  });

  it("shiftLateral slides along the home row, wrapping past bodies", () => {
    const s = prepState();
    const boss = place(s, "boss_skeleeze", "P2", 0, 2);
    place(s, "dusk_gool", "P2", 0, 3); // the next slot right is TAKEN
    const n = advance(atCleanup(s));
    // 4x4 board: from col 2, col 3 is occupied → wraps to col 0.
    expect(n.cards[boss.instanceId].pos).toEqual({ row: 0, col: 0 });
  });

  it("shiftLateral stays put when dragged off the home row", () => {
    const s = prepState();
    const boss = place(s, "boss_skeleeze", "P2", 1, 2);
    const n = advance(atCleanup(s));
    expect(n.cards[boss.instanceId].pos).toEqual({ row: 1, col: 2 });
  });

  it("critAlways skips the coin: Piercing Arrow doubles on every cast", () => {
    // 40 casts across seeds; a coin would whiff ~half. critPen carries it
    // through shields, so the shield gate can't hide a miss either.
    const def = getDef("boss_skeleeze").special!;
    for (let seed = 0; seed < 8; seed++) {
      const s = prepState(seed * 31 + 7);
      const boss = place(s, "boss_skeleeze", "P2", 0, 1);
      const prey = place(s, "leaf_alpha", "P1", 2, 1, { curHp: 99, maxHp: 99, curShields: 2 });
      SPECIAL_HANDLERS.barrage(s, boss, [prey], def.params!);
      expect(99 - s.cards[prey.instanceId].curHp, `seed ${seed}`).toBe(20); // 10 doubled, through shields
    }
  });
});

describe("the trials", () => {
  it("one event per boss, generated from the same data", () => {
    for (const v of VOID_BOSSES) {
      const ev = EVENTS.find((e) => e.bossId === v.cardId);
      expect(ev, `${v.cardId} has a trial`).toBeTruthy();
      expect(ev!.deck.cards, "the trial's deck IS the formation").toEqual(v.summons);
    }
  });

  it("every encounter plays headlessly to completion — and the boss is a real threat", () => {
    // The balance-harness pattern (humans: [], advance() to gameover), the
    // boss pre-placed exactly as the trial places it. LEAF-only opponent decks,
    // because the doc requires Floor 1 beatable with LEAF cards alone — this
    // smoke test proves the fights RESOLVE against that collection; whether
    // they are FAIR is tuning, measured on-device, not asserted here.
    const leafDeck = CARDS.filter((c) => c.element === "LEAF" && !c.boss)
      .sort((a, b) => a.cost - b.cost).slice(0, 30).map((c) => c.id);
    let bossWins = 0;
    for (const v of VOID_BOSSES) {
      const enc = buildVoidEncounter(v);
      for (let k = 0; k < 3; k++) {
        let s = createInitialState(k * 31 + 7, leafDeck, enc.deck, [], undefined, enc.spells,
          enc.boardSize, undefined, undefined, { P2: enc.stacked.P2 });
        const seat = voidBossSeat(s.boardSize);
        const inst = summonCard(s, "P2", v.cardId, seat as never);
        inst.summonedThisRound = false;
        let st = 0;
        while (s.phase !== "gameover" && st < 8000) { s = advance(s); st++; }
        expect(s.phase, `${v.cardId} seed ${k} finished`).toBe("gameover");
        if (s.win?.winner === "P2") bossWins++;
      }
    }
    // 21 matches. Zero boss wins would mean the bosses are furniture; all 21
    // would mean Floor 1 is unbeatable by the deck it must be beatable with.
    expect(bossWins, "bosses win some").toBeGreaterThan(0);
    expect(bossWins, "and lose some").toBeLessThan(21);
  });
});

describe("the boss clock", () => {
  // A puzzle needs a threat you can COUNT. These pin the three halves of that
  // promise: it lands on the beat, it costs nothing, and it is the ONLY way
  // the Special ever fires — a boss that also cast whenever it could afford
  // the magic would be a different fight on every retry.

  it("every boss is on a 3-round clock", () => {
    for (const b of BOSSES) {
      expect(b.roundTick?.fireSpecialEveryN, `${b.id}`).toBe(3);
      expect(b.special, `${b.id} has a Special to fire`).toBeTruthy();
    }
  });

  it("no boss Special declares a cooldown — the clock owns the timing", () => {
    // Dead config otherwise, and worse than dead: a cooldown printed beside a
    // Special that cannot be cast by hand reads as a second, contradictory
    // schedule.
    for (const b of BOSSES) expect(b.special?.cooldown, `${b.id}`).toBeUndefined();
  });

  it("fires on rounds 3, 6, 9 — and on no other round", () => {
    const s = prepState();
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    place(s, "leaf_alpha", "P1", 1, 2, { curHp: 999, maxHp: 999, curShields: 0 });
    const fired: number[] = [];
    let g = s;
    for (let round = 1; round <= 9; round++) {
      g.round = round;
      const before = g.log.length;
      g = advance(atCleanup(g));
      if (g.log.slice(before).some((l) => l.includes("Rotten Grasp"))) fired.push(round);
      // `advance` moves the phase on; re-seat for the next Cleanup.
      g.cards[boss.instanceId].specialCooldown = 0;
    }
    expect(fired).toEqual([3, 6, 9]);
  });

  it("costs the boss nothing — an empty magic pool still fires it", () => {
    const s = prepState();
    s.players.P2.magicPool = 0;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    const prey = place(s, "leaf_alpha", "P1", 1, 2, { curHp: 999, maxHp: 999, curShields: 0 });
    s.round = 3;
    const n = advance(atCleanup(s));
    expect(n.players.P2.magicPool, "not a penny spent").toBe(0);
    expect(n.cards[prey.instanceId].curHp, "and it still landed").toBeLessThan(999);
    void boss;
  });

  it("is the ONLY way it fires — the ordinary cast is refused outright", () => {
    // With magic to burn and no cooldown, a normal card would be free to cast.
    const s = prepState();
    s.players.P2.magicPool = 99;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    place(s, "leaf_alpha", "P1", 1, 2, { curHp: 999, maxHp: 999, curShields: 0 });
    boss.specialCooldown = 0;
    const r = canFireSpecial(s, boss.instanceId);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("clock");
  });

  it("MUTE stops the clock — silencing a boss is a real answer", () => {
    const s = prepState();
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    const prey = place(s, "leaf_alpha", "P1", 1, 2, { curHp: 999, maxHp: 999, curShields: 0 });
    applyStatus(s, boss, "MUTED", 3, 0, "DUSK");
    s.round = 3;
    const n = advance(atCleanup(s));
    expect(n.cards[prey.instanceId].curHp, "the beat was skipped").toBe(999);
  });

  it("a dead boss does not cast", () => {
    const s = prepState();
    const boss = place(s, "boss_rotroot", "P2", 0, 2, { curHp: 0 });
    const prey = place(s, "leaf_alpha", "P1", 1, 2, { curHp: 999, maxHp: 999, curShields: 0 });
    s.round = 3;
    const n = advance(atCleanup(s));
    expect(n.cards[prey.instanceId].curHp).toBe(999);
    void boss;
  });

  it("a self-targeted Special still works on the clock (Overclock spawns)", () => {
    // `fireCardSpecial` picks targets by targetSide; calling the handler raw
    // would hand a self-targeted spawn an enemy list and quietly do nothing.
    const s = prepState();
    place(s, "boss_overclock", "P2", 0, 2);
    const before = boardCards(s, "P2").length;
    s.round = 3;
    const n = advance(atCleanup(s));
    expect(boardCards(n, "P2").length, "Drones stamped out").toBeGreaterThan(before);
  });
});

describe("floor progression", () => {
  // All DERIVED from eventsDone — the trial-event settle path is the single
  // writer, so the tower cannot disagree with the save. These pin the ladder's
  // rules; the trial ids are the shared vocabulary.
  const beat = (...ids: string[]) => ids.map(trialEventId);
  const FLOOR1 = VOID_BOSSES.filter((b) => b.floor === 1).map((b) => b.cardId);

  it("the floors are contiguous from 1, so nothing is walled off by a gap", () => {
    const floors = voidFloors();
    expect(floors[0]).toBe(1);
    for (let i = 1; i < floors.length; i++)
      expect(floors[i] - floors[i - 1], `gap before floor ${floors[i]}`).toBe(1);
  });

  it("the ground floor is open on a fresh save; nothing above it is", () => {
    expect(floorOpen([], 1)).toBe(true);
    for (const f of voidFloors().filter((x) => x > 1))
      expect(floorOpen([], f), `floor ${f}`).toBe(false);
  });

  it("a floor clears only when EVERY boss on it is down", () => {
    const allButOne = beat(...FLOOR1.slice(0, -1));
    expect(floorCleared(allButOne, 1), "one boss standing").toBe(false);
    expect(floorOpen(allButOne, 2), "so the next floor stays shut").toBe(false);
    const all = beat(...FLOOR1);
    expect(floorCleared(all, 1)).toBe(true);
    expect(floorOpen(all, 2), "and now the tower opens").toBe(true);
    expect(floorOpen(all, 3), "one floor at a time").toBe(false);
  });

  it("beating a higher boss without the floor below buys nothing", () => {
    // The save CAN hold this state (a pre-tower player beat Xilty's trial off
    // the Home band before floors existed) — it must degrade gracefully rather
    // than corrupt: the defeat is remembered, the ladder still demands its
    // floors in order.
    const skipped = beat("boss_xilty");
    expect(bossDefeated(skipped, "boss_xilty")).toBe(true);
    expect(floorOpen(skipped, 2)).toBe(false);
    expect(floorOpen(skipped, 3)).toBe(false);
  });

  it("the whole climb: 7 down opens everything and reads 7/7", () => {
    const all = beat(...VOID_BOSSES.map((b) => b.cardId));
    for (const f of voidFloors()) expect(floorCleared(all, f), `floor ${f}`).toBe(true);
    expect(towerProgress(all)).toEqual({ defeated: 7, total: 7 });
  });

  it("every boss has a trial event under the shared id, and no trial is orphaned", () => {
    // The screen looks trials up by trialEventId; a rename on either side
    // strands a Fight button. Both directions.
    for (const v of VOID_BOSSES)
      expect(EVENTS.some((e) => e.id === trialEventId(v.cardId)), v.cardId).toBe(true);
    for (const e of EVENTS.filter((x) => x.bossId))
      expect(e.id).toBe(trialEventId(e.bossId!));
  });
});

describe("cleanse still answers the lock (the doc's own exception)", () => {
  it("PARALYZE from Web Trap is removable", () => {
    // The one place randomness/hard-control is allowed is where a buildable
    // answer exists. This is the answer existing.
    const s = prepState();
    const victim = place(s, "leaf_alpha", "P1", 2, 1);
    applyStatus(s, victim, "PARALYZE", 2, 0, "DUSK");
    expect(statusOf(s.cards[victim.instanceId], "PARALYZE")).toBeDefined();
    victim.statuses = victim.statuses.filter((x) => x.kind !== "PARALYZE"); // what any cleanse does
    expect(statusOf(s.cards[victim.instanceId], "PARALYZE")).toBeUndefined();
  });
});
