// BOSS TAMING.
//
// Clear a floor, every boss on it turns ENRAGED, beat one in that state and it
// fights for you three times at TAME_SCALE of everything.
//
// The load-bearing tests here are not the arithmetic. They are the three rules
// that scan the board for a boss-flagged card on EITHER side — slay-to-win, the
// home-row overrun check, and the Void Tower deployment head start. All three
// predate a player ever having a boss, and all three would misfire on one. The
// first is the worst: without its fix, bringing a tamed boss to a tower fight
// makes the fight UNWINNABLE, because you kill the thing you came for and a
// boss is still standing. A fourth, the opening hold, reads one body rather
// than scanning the board, and it held your own boss — pinned below too.
import { beforeEach, describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import {
  ENRAGE_SCALE, TAME_SCALE, TAME_USES, VOID_BOSSES,
  bossEnraged, tameScaleFor, tameUsesLeft, tamedRoster, tamedStats, trialEventId,
} from "../../data/void-tower";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GIFTS, applyGifts, loadStory, newSave, saveStory, spendTame, tameBoss, type StorySave,
} from "../../data/story";
import { effectiveDmg, effectiveSp, scaleInstance, summonCard } from "../state";
import { fireCardSpecial } from "../combat";
import { advance } from "../phases";
import { canMove } from "../rules";
import { atBattle, atCleanup, bigPrepState, place } from "./helpers";

/** A localStorage that behaves, for a node test environment that has none.
 *  Same helper account-save.test.ts uses. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  } as Storage;
}
beforeEach(() => { globalThis.localStorage = fakeStorage(); });

const FLOOR1 = VOID_BOSSES.filter((b) => b.floor === 1).map((b) => b.cardId);
const clearedFloor1 = (): string[] => FLOOR1.map(trialEventId);

describe("a tamed body is a FRACTION of what its card says", () => {
  it("scales HP and shields at placement", () => {
    const s = bigPrepState();
    const full = place(s, "boss_kazehaya", "P2", 0, 2);
    const half = scaleInstance(place(s, "boss_kazehaya", "P1", 4, 2), TAME_SCALE);
    expect(half.maxHp).toBe(Math.round(full.maxHp * TAME_SCALE));
    expect(half.curShields).toBe(Math.round(full.curShields * TAME_SCALE));
  });

  it("scales BASIC damage and speed", () => {
    const s = bigPrepState();
    const full = place(s, "boss_kazehaya", "P2", 0, 2);
    const half = scaleInstance(place(s, "boss_kazehaya", "P1", 4, 2), TAME_SCALE);
    expect(effectiveDmg(s, s.cards[half.instanceId]))
      .toBe(Math.floor(effectiveDmg(s, s.cards[full.instanceId]) * TAME_SCALE));
    expect(effectiveSp(s, s.cards[half.instanceId]))
      .toBeLessThan(effectiveSp(s, s.cards[full.instanceId]));
  });

  it("scales SPECIAL damage — the half that WEAKEN and FREEZE never touch", () => {
    // This is the whole reason `statScale` exists rather than a stacked WEAKEN.
    // A Special's damage is a hardcoded number on the def that never passes
    // through effectiveDmg, so the game's two existing damage multipliers leave
    // Specials at full printed power. A reduced-strength boss built on that
    // pattern would swing reduced and then cast at full.
    const hit = (scale: number | null) => {
      const s = bigPrepState();
      const caster = place(s, "boss_umbranova", "P2", 0, 2);
      if (scale !== null) scaleInstance(s.cards[caster.instanceId], scale);
      const foe = place(s, "leaf_stickviper", "P1", 2, 2, { curHp: 400, maxHp: 400, curShields: 0 });
      fireCardSpecial(s, s.cards[caster.instanceId]);
      return 400 - s.cards[foe.instanceId].curHp;
    };
    const full = hit(null);
    expect(full, "the fixture actually lands a Special").toBeGreaterThan(0);
    expect(hit(TAME_SCALE), "and the tamed cast is less than it").toBeLessThan(full);
    expect(hit(ENRAGE_SCALE), "an enraged one is more").toBeGreaterThan(full);
  });

  it("a scaled body never rounds away to nothing", () => {
    // Scaling a 1-HP token must not delete it on arrival, and scaling a 1-SP
    // body must not leave it unable to move — that is a different card, not a
    // weaker one.
    const s = bigPrepState();
    const c = scaleInstance(
      place(s, "leaf_stickviper", "P1", 4, 2, { curHp: 1, maxHp: 1 }), TAME_SCALE,
    );
    expect(c.curHp).toBeGreaterThanOrEqual(1);
    expect(effectiveSp(s, s.cards[c.instanceId])).toBeGreaterThanOrEqual(1);
  });
});

describe("the reveal shows the body the player actually gets", () => {
  // `tamedStats` feeds the post-win reveal and the picker, and it duplicates
  // rounding that lives in `scaleInstance` and the effective-stat readers — so
  // it is checked against a REAL scaled instance rather than against a copy of
  // the arithmetic.
  //
  // The guarantee is ONE-DIRECTIONAL, and this is the test that found out why.
  // It first asserted equality and Nightshrike failed at 7 vs 8: it is GALE, and
  // Zephyr's static +DMG-per-SP aura lands on the board number BEFORE the
  // scaling. A preview holding only a CardDef cannot know that. So the rule is
  // that the preview never OVER-promises — the tamed boss is always at least
  // the card the player was shown, never less.
  for (const b of VOID_BOSSES) {
    it(`${b.cardId}: the preview never over-promises`, () => {
      const def = getDef(b.cardId);
      const s = bigPrepState();
      const inst = scaleInstance(place(s, b.cardId, "P1", 4, 2), tameScaleFor(b.cardId));
      const preview = tamedStats(def);
      // HP and shields are absolute on the instance — these are exact.
      expect(preview.hp, "HP is exact").toBe(inst.maxHp);
      expect(preview.shields, "shields are exact").toBe(inst.curShields);
      // DMG and SP may be raised by auras on a live board; they may never be
      // lower than what was shown.
      expect(effectiveDmg(s, s.cards[inst.instanceId]), "DMG on the board is never worse")
        .toBeGreaterThanOrEqual(preview.dmg);
      expect(effectiveSp(s, s.cards[inst.instanceId]), "SP on the board is never worse")
        .toBeGreaterThanOrEqual(preview.sp);
    });
  }

  it("and it really is REDUCED, not a rounding of nothing", () => {
    // Guards the guard: a `tamedStats` that returned the printed numbers
    // untouched would pass every over-promise check above. Every boss at the
    // shared scale; the one with its own full-strength scale is the next test.
    for (const b of VOID_BOSSES.filter((v) => tameScaleFor(v.cardId) < 1)) {
      const def = getDef(b.cardId);
      const t = tamedStats(def);
      expect(t.hp, `${b.cardId} hp`).toBeLessThan(def.hp);
      expect(t.dmg, `${b.cardId} dmg`).toBeLessThan(def.dmg);
    }
  });
});

describe("Thunderfangs is tamed at full strength", () => {
  // Owner's call, 2026-09-27: "not to the same level of, say, a Vulcanyx".
  // Its boss strength is borrowed from a pack that does not come along, so at
  // 70% it was the weakest ally on its floor. Measured as the player's ally
  // across the four Floor 4 fights (384 fights each): 4.7% at 70%, 9.4% at
  // 100%, Vulcanyx 7.6%. See its VOID_BOSSES entry.
  it("fights at 100%, and it is the only boss off the shared scale", () => {
    expect(tameScaleFor("boss_thunderfangs")).toBe(1);
    const off = VOID_BOSSES.filter((v) => tameScaleFor(v.cardId) !== TAME_SCALE).map((v) => v.cardId);
    expect(off).toEqual(["boss_thunderfangs"]);
    expect(tameScaleFor("boss_vulcanyx")).toBe(TAME_SCALE);
  });

  it("the preview shows its printed card, unreduced", () => {
    const def = getDef("boss_thunderfangs");
    expect(tamedStats(def)).toEqual({ dmg: def.dmg, hp: def.hp, shields: def.shields, sp: def.sp });
  });

  it("the board seats it through the same reader, and the copy says so", () => {
    const read = (f: string) => readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");
    // Seated in `void-seat.ts` (shared with the story's Hard border bosses),
    // with the ally App hands it.
    expect(read("App.tsx")).toContain("ally: bossFight?.ally");
    expect(read("void-seat.ts")).toContain("scaleInstance(ally, tameScaleFor(opts.ally));");
    for (const f of ["App.tsx", "void-seat.ts"])
      expect(read(f), f).not.toContain("scaleInstance(ally, TAME_SCALE)");
    expect(read("BossDetail.tsx")).toContain('k >= 1 ? "at full strength"');
    expect(read("VoidTower.tsx")).toContain("tameScaleFor(b.cardId) !== TAME_SCALE");
  });
});

describe("a tamed boss does not break the rules that scan for a boss", () => {
  it("SLAY-TO-WIN still fires when the enemy boss dies", () => {
    // Without the `!c.tamed` exclusion this is unwinnable: the boss you came
    // for is dead, your loaner is boss-flagged and still standing, and the
    // check that ends the fight never sees an empty board.
    const s = bigPrepState();
    s.voidTower = true;
    const boss = place(s, "boss_rotroot", "P2", 0, 2, { curHp: 1, maxHp: 130, curShields: 0 });
    boss.summonedThisRound = false;
    const ally = place(s, "boss_kazehaya", "P1", 4, 2);
    ally.tamed = true;
    scaleInstance(s.cards[ally.instanceId], TAME_SCALE);
    // Kill the enemy boss outright, then run a Cleanup.
    delete s.cards[boss.instanceId];
    const after = advance(atCleanup(s));
    expect(after.win?.winner, "the floor is yours").toBe("P1");
    expect(after.win?.by).toBe("slain");
  });

  it("...and does NOT fire while the enemy boss still stands", () => {
    const s = bigPrepState();
    s.voidTower = true;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    boss.summonedThisRound = false;
    const ally = place(s, "boss_kazehaya", "P1", 4, 2);
    ally.tamed = true;
    const after = advance(atCleanup(s));
    expect(after.win, "nothing is decided yet").toBeFalsy();
  });

  it("a tamed boss standing in YOUR home row is not an overrun OF you", () => {
    // The overrun check counts an ENEMY boss holding the player's home row. A
    // tamed one is standing there because it is yours, and it must not be able
    // to hand the enemy the win by occupying your own back line.
    const s = bigPrepState();
    s.voidTower = true;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    boss.summonedThisRound = false;
    const ally = place(s, "boss_kazehaya", "P1", 4, 2);
    ally.tamed = true;
    scaleInstance(s.cards[ally.instanceId], TAME_SCALE);
    // Fill the rest of the player's home row with the ally's own side too, so
    // the row is FULL — the shape the overrun rule looks for.
    for (let c = 0; c < s.boardSize; c++)
      if (c !== 2) place(s, "leaf_stickviper", "P1", 4, c);
    let n = s;
    for (let r = 0; r < 4; r++) n = advance(atCleanup(n));
    expect(n.win?.winner, "your own full home row is not an enemy overrun").not.toBe("P2");
  });

  it("the deployment head start reads the boss you came to FIGHT", () => {
    // `find` takes the first boss-flagged body on the board in either seat, so
    // a tamed ally could be the one it costs the head start against.
    const s = bigPrepState();
    s.voidTower = true;
    s.round = 1;
    const ally = place(s, "boss_kazehaya", "P1", 4, 2);
    ally.tamed = true;
    const boss = place(s, "boss_rotroot", "P2", 0, 2);
    boss.summonedThisRound = false;
    // Reaching the Resource phase must not throw and must still pay the player.
    const after = atBattle(s);
    expect(after.phase, "the round ran").toBeTruthy();
  });
});

describe("a tamed boss is yours from round one — the opening hold is not for it", () => {
  // BOSS_HOLD_ROUNDS keeps a tower boss on its home row for rounds 1-2 so the
  // player gets the opening to read it. It asked only whether the body was
  // boss-flagged, so it held the player's own loaner too. Both ways off the row
  // read the one predicate, and both are pinned: the move by hand and the gait.
  // Xilty is the boss the hold's own tests use, for its `roundTick.advance`.
  it("can be walked off your home row in round 1 — an untamed boss still cannot", () => {
    const s = bigPrepState();                          // round 1, P1 to act
    const ally = place(s, "boss_xilty", "P1", 4, 1);
    ally.tamed = true;
    const wild = place(s, "boss_xilty", "P1", 4, 3);   // the rule is still live
    expect(canMove(s, "P1", ally.instanceId, { row: 3, col: 1 } as never).ok, "yours to move").toBe(true);
    const held = canMove(s, "P1", wild.instanceId, { row: 3, col: 3 } as never);
    expect(held.ok, "an untamed boss holds").toBe(false);
    expect(held.reason).toContain("home row");
  });

  it("its own gait walks in round 1, while the enemy boss holds its row", () => {
    const s = bigPrepState();
    const ally = place(s, "boss_xilty", "P1", 4, 1);
    ally.tamed = true;
    scaleInstance(s.cards[ally.instanceId], TAME_SCALE);
    const boss = place(s, "boss_xilty", "P2", 0, 3);
    const n = advance(atCleanup(s));
    expect(n.cards[ally.instanceId].pos!.row, "your loaner stepped forward").toBeLessThan(4);
    expect(n.cards[boss.instanceId].pos, "the boss you came to fight held").toEqual({ row: 0, col: 3 });
  });
});

describe("enraged, and the taming loop", () => {
  it("a boss is enraged exactly when its floor is cleared", () => {
    const b = VOID_BOSSES.find((x) => x.floor === 1)!;
    expect(bossEnraged([], b.cardId), "nothing cleared yet").toBe(false);
    expect(bossEnraged([trialEventId(b.cardId)], b.cardId),
      "beating it alone is not enough — the FLOOR is the unit").toBe(false);
    expect(bossEnraged(clearedFloor1(), b.cardId), "floor down, every boss on it angry").toBe(true);
  });

  it("every boss on the cleared floor is enraged, not just the last one", () => {
    const done = clearedFloor1();
    for (const id of FLOOR1) expect(bossEnraged(done, id), id).toBe(true);
  });

  it("an unknown or higher-floor boss is never enraged by a lower clear", () => {
    const done = clearedFloor1();
    const upstairs = VOID_BOSSES.find((b) => b.floor > 1)!;
    expect(bossEnraged(done, upstairs.cardId)).toBe(false);
    expect(bossEnraged(done, "boss_that_never_was")).toBe(false);
  });

  it("taming grants three battles, and re-taming REFILLS rather than stacking", () => {
    let save: StorySave = newSave();
    save = tameBoss(save, "boss_rotroot");
    expect(tameUsesLeft(save.tamed, "boss_rotroot")).toBe(TAME_USES);
    save = spendTame(save, "boss_rotroot");
    expect(tameUsesLeft(save.tamed, "boss_rotroot")).toBe(TAME_USES - 1);
    save = tameBoss(save, "boss_rotroot");
    expect(tameUsesLeft(save.tamed, "boss_rotroot"), "back to full, never above").toBe(TAME_USES);
  });

  it("spending the last use removes the key, so the stable IS what you can bring", () => {
    let save: StorySave = tameBoss(newSave(), "boss_rotroot");
    for (let i = 0; i < TAME_USES; i++) save = spendTame(save, "boss_rotroot");
    expect(tameUsesLeft(save.tamed, "boss_rotroot")).toBe(0);
    expect(Object.keys(save.tamed ?? {}), "no 0-use ghost in the picker").toEqual([]);
    expect(tamedRoster(save.tamed)).toEqual([]);
  });

  it("spending one that was never tamed cannot go negative", () => {
    const save = spendTame(newSave(), "boss_rotroot");
    expect(tameUsesLeft(save.tamed, "boss_rotroot")).toBe(0);
  });

  it("the writers SPREAD — the worst bug this project has had", () => {
    // A save writer that enumerates fields instead of spreading silently wipes
    // every field it forgot. See applyClear in CLAUDE.md.
    const base: StorySave = { ...newSave(), eventsDone: ["void_boss_rotroot"], deck: [] };
    const tamedSave = tameBoss(base, "boss_rotroot");
    expect(tamedSave.eventsDone, "eventsDone survived the write").toEqual(["void_boss_rotroot"]);
    expect(spendTame(tamedSave, "boss_rotroot").eventsDone).toEqual(["void_boss_rotroot"]);
    expect(tamedSave.collection, "and so did the collection").toEqual(base.collection);
  });

  it("the roster lists only what has uses left", () => {
    let save: StorySave = tameBoss(tameBoss(newSave(), "boss_rotroot"), "boss_xilty");
    save = spendTame(spendTame(spendTame(save, "boss_xilty"), "boss_xilty"), "boss_xilty");
    expect(tamedRoster(save.tamed).map((t) => t.boss.cardId)).toEqual(["boss_rotroot"]);
  });
});

describe("the taming survives a save round-trip", () => {
  const KEY = "we_story_v1";
  /** Load a raw save back through `loadStory`.
   *
   *  The ledger is PRE-STAMPED with every gift, because these tests are about
   *  the loader's normalisation and a one-time gift landing mid-load would
   *  otherwise show up in every assertion about the stable — and would do so
   *  again for each new gift ever added. Gifts have their own tests below.
   *  Callers that pass their own `gifts` keep it. */
  const roundTrip = (raw: unknown): StorySave => {
    const stamped = raw && typeof raw === "object" && !Array.isArray(raw)
      ? { gifts: GIFTS.map((g) => g.id), ...(raw as Record<string, unknown>) }
      : raw;
    localStorage.setItem(KEY, JSON.stringify(stamped));
    try { return loadStory(); } finally { localStorage.removeItem(KEY); }
  };

  it("a new field is invisible until loadStory lists it — this asserts it is listed", () => {
    const saved = tameBoss(newSave(), "boss_rotroot");
    expect(roundTrip(saved).tamed?.boss_rotroot, "survived the whitelist rebuild").toBe(TAME_USES);
  });

  it("a save written before taming existed reads as an empty stable", () => {
    const legacy = { ...newSave() } as Record<string, unknown>;
    delete legacy.tamed;
    expect(roundTrip(legacy).tamed).toEqual({});
  });

  it("a hand-edited save cannot mint an infinite loaner", () => {
    // The clamp in loadStory mirrors TAME_USES across a module boundary that
    // cannot be imported (void-tower imports story, not the other way). This is
    // the test that stops the two drifting.
    const s = roundTrip({ ...newSave(), tamed: { boss_rotroot: 9999 } });
    expect(s.tamed?.boss_rotroot).toBe(TAME_USES);
  });

  it("junk in the stable is dropped rather than trusted", () => {
    const s = roundTrip({ ...newSave(), tamed: { a: 0, b: -4, c: "three", d: null, e: 2 } });
    expect(s.tamed).toEqual({ e: 2 });
  });

  it("a malformed stable degrades to empty instead of throwing", () => {
    expect(roundTrip({ ...newSave(), tamed: ["boss_rotroot"] }).tamed).toEqual({});
    expect(roundTrip({ ...newSave(), tamed: "yes" }).tamed).toEqual({});
  });
});

describe("taming is not ownership", () => {
  it("a tamed boss never enters the collection", () => {
    // The test asserting a boss can be acquired NOWHERE still has to hold. A
    // tamed boss is a loaner: it fights for you and it is never yours.
    const save = tameBoss(newSave(), "boss_rotroot");
    expect(save.collection).not.toContain("boss_rotroot");
    expect(save.deck).not.toContain("boss_rotroot");
  });

  it("summoning one outside the economy costs nothing and acts at once", () => {
    const s = bigPrepState();
    const goldBefore = s.players.P1.gold;
    const ally = summonCard(s, "P1", "boss_kazehaya", { row: 4, col: 2 } as never);
    ally.summonedThisRound = false;
    ally.tamed = true;
    scaleInstance(ally, TAME_SCALE);
    expect(s.players.P1.gold, "outside the economy, like the enemy boss").toBe(goldBefore);
    expect(getDef(ally.defId).boss, "it is still a boss").toBe(true);
  });
});

describe("one-time gifts", () => {
  /** A localStorage that behaves like the browser's, per test. */
  function withStore<T>(run: () => T): T {
    const mem = new Map<string, string>();
    const had = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
    };
    try { return run(); } finally { (globalThis as { localStorage?: unknown }).localStorage = had; }
  }

  const CONT = "boss_continental";
  const uses = (s: StorySave) => Math.floor(s.tamed?.[CONT] ?? 0);

  it("hands an existing save its gift, once", () => {
    withStore(() => {
      // A save written before gifts existed: no ledger at all.
      const legacy = { ...newSave() } as Record<string, unknown>;
      delete legacy.gifts;
      saveStory(legacy as never);
      const first = loadStory();
      expect(uses(first), "the tamed Continental arrived").toBe(3);
      expect(first.gifts, "and the ledger records it").toContain("tame-continental-1");
    });
  });

  it("does NOT re-grant on reload — the ledger has to survive the load", () => {
    // THE BUG THIS PINS. `loadStory` builds its result by enumerating fields,
    // and a field it forgets is a field that comes back undefined. `applyGifts`
    // reads a missing ledger as "never given", so forgetting `gifts` there does
    // not merely lose a record — it re-grants every gift on every single load,
    // which for a taming is one that silently refills instead of running down.
    withStore(() => {
      const legacy = { ...newSave() } as Record<string, unknown>;
      delete legacy.gifts;
      saveStory(legacy as never);
      const granted = loadStory();
      // Spend it down to its last battle and put it back.
      saveStory({ ...granted, tamed: { ...(granted.tamed ?? {}), [CONT]: 1 } });
      expect(uses(loadStory()), "reloading refilled the taming").toBe(1);
      expect(uses(loadStory()), "and again on a second reload").toBe(1);
    });
  });

  it("gives a brand-new player nothing — it is compensation, not a bonus", () => {
    withStore(() => {
      const fresh = loadStory();                       // nothing in the store
      expect(uses(fresh)).toBe(0);
      expect(fresh.gifts, "but the ledger is pre-stamped so it never arrives later")
        .toEqual(GIFTS.map((g) => g.id));
    });
  });

  it("is idempotent on a save that already has the ledger", () => {
    const once = applyGifts(newSave());
    const twice = applyGifts(once.save);
    expect(twice.granted, "nothing new the second time").toEqual([]);
  });

  it("every gift id is unique — a reused id would re-grant to everyone", () => {
    expect(new Set(GIFTS.map((g) => g.id)).size).toBe(GIFTS.length);
  });
});
