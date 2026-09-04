// Milestone 3: targeting — melee rows, ranged, Home Slot Rule, FLYING, STEALTH.

import { describe, expect, it } from "vitest";
import { canFireSpecial, canMove, canSpellHitEnemy, canTarget, previewOnSummonArea, rangedCanSee, rangedReachFor, specialTargets, validSpecialTargets, validTargets } from "../rules";
import { applyStatus, SPECIAL_HANDLERS } from "../combat";
import { applyIntent } from "../phases";
import { CARDS, getDef } from "../../data/cards";
import { bigPrepState, giveHand, place, prepState } from "./helpers";
import type { Pos } from "../types";

const key = (p: Pos) => `${p.row},${p.col}`;

describe("previewOnSummonArea (placement preview)", () => {
  it("corridor blast (Pyrogon) → the 3-wide corridor, 2 rows deep (matches its Special)", () => {
    const s = prepState();
    const area = previewOnSummonArea(s, getDef("pyro_pyrogon"), "P1", { row: 3, col: 1 });
    expect(new Set(area.map(key))).toEqual(new Set(["2,0", "2,1", "2,2", "1,0", "1,1", "1,2"]));
  });

  it("no-spread on-summon (Krakler) → the reachable enemy cards (king reach)", () => {
    const s = prepState();
    const near = place(s, "dusk_gool", "P2", 2, 1); // king-adjacent to home (3,1)
    place(s, "dusk_vamp", "P2", 0, 0); // far away — out of a melee's reach
    const area = previewOnSummonArea(s, getDef("aqua_krakler"), "P1", { row: 3, col: 1 });
    expect(area.map(key)).toEqual([key(near.pos!)]);
  });

  it("ally / no-on-summon cards preview nothing", () => {
    const s = prepState();
    expect(previewOnSummonArea(s, getDef("leaf_greegon"), "P1", { row: 3, col: 1 })).toHaveLength(0);
  });

  // THE PREVIEW USED TO OVER-PROMISE, and badly. It understood exactly one
  // shape — `spread` — and everything else fell through to "normal targeting
  // reach", which for a Ranged card is EVERY enemy on the board. So Saltjacks,
  // whose on-summon is a line down its own column, lit the whole board red; so
  // did Aftermath and Infernus Rex for a one-row sweep. The narrowing those
  // cards actually get is applied by `barrage` AFTER the targets are sourced,
  // and the preview never ran it.
  //
  // It also under-promised in the other direction: a `reachNearest` pounce
  // reaches the whole board, and the preview lit only the melee neighbours.
  //
  // Both halves are now one cascade (`onSummonTargets`) plus one narrowing
  // (`volleyFilters`), shared with the engine — so these pin the SHAPES, and the
  // test after them pins that the preview and the engine agree exactly.
  it("sameColumn (Saltjacks) → its own column only, not the whole board", () => {
    const s = prepState();
    const inCol = place(s, "dusk_vamp", "P2", 0, 1);
    place(s, "dusk_gool", "P2", 0, 0);   // same row, different column
    place(s, "dusk_harve", "P2", 1, 3);  // nowhere near the column
    const area = previewOnSummonArea(s, getDef("aqua_buccaneers"), "P1", { row: 3, col: 1 });
    expect(area.map(key)).toEqual([key(inCol.pos!)]);
  });

  it("rowAhead (Aftermath) → the row directly ahead only", () => {
    const s = prepState();
    // Aftermath is Ranged: before the fix its preview was every enemy alive.
    const ahead = place(s, "dusk_vamp", "P2", 2, 0);
    const alsoAhead = place(s, "dusk_gool", "P2", 2, 3);
    place(s, "dusk_harve", "P2", 0, 1);  // two rows further on — not the row ahead
    const area = new Set(previewOnSummonArea(s, getDef("pyro_aftermath"), "P1", { row: 3, col: 1 }).map(key));
    expect(area).toEqual(new Set([key(ahead.pos!), key(alsoAhead.pos!)]));
  });

  it("rowAhead on a MELEE card (Infernus Rex) is still bounded by its reach", () => {
    // Worth pinning because it is the one place `rowAhead` does NOT widen
    // anything: the row is a filter applied to what the card could already see,
    // and a Melee card sees its eight neighbours. So the sweep is the row ahead
    // INTERSECTED with king reach — the far end of the row is never touched,
    // and the preview that shows only the near square is telling the truth.
    const s = prepState();
    const near = place(s, "dusk_vamp", "P2", 2, 1);
    place(s, "dusk_gool", "P2", 2, 3); // same row, out of a melee's reach
    const area = new Set(previewOnSummonArea(s, getDef("pyro_infernus_rex"), "P1", { row: 3, col: 1 }).map(key));
    expect(area).toEqual(new Set([key(near.pos!)]));
  });

  it("reachNearest (Krakler) → the nearest enemy anywhere, and only that one", () => {
    const s = prepState();
    // Nothing is king-adjacent, which is exactly the case the old preview got
    // wrong in the OTHER direction: it drew nothing at all, while the engine
    // reached across the board and struck.
    const nearest = place(s, "dusk_vamp", "P2", 1, 1);
    place(s, "dusk_gool", "P2", 0, 3);
    const area = previewOnSummonArea(s, getDef("aqua_krakler"), "P1", { row: 3, col: 1 });
    expect(area.map(key)).toEqual([key(nearest.pos!)]);
  });

  /** Summon `id` at (3,1) for real and report which planted enemies it hurt. */
  function struckBySummoning(id: string) {
    const s = prepState();
    s.players.P1.gold = 99;
    const victims = [
      place(s, "dusk_vamp", "P2", 2, 1),
      place(s, "dusk_gool", "P2", 2, 3),
      place(s, "dusk_harve", "P2", 0, 1),
      place(s, "dusk_zhunk", "P2", 1, 2),
    ];
    const before = new Map(victims.map((v) => [v.instanceId, v.curHp]));
    const drawn = new Set(previewOnSummonArea(s, getDef(id), "P1", { row: 3, col: 1 }).map(key));
    const handId = giveHand(s, "P1", id);
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const struck = new Set<string>();
    for (const v of victims) {
      const after = next.cards[v.instanceId];
      // Gone entirely, or lighter than it was — either way the volley reached it.
      if (!after || after.curHp < before.get(v.instanceId)!) struck.add(key(v.pos!));
    }
    return { drawn, struck };
  }

  it("the preview is exactly what the volley hits (Saltjacks)", () => {
    // The claim the refactor rests on: ONE cascade, read by the engine on
    // arrival and by the preview beforehand. Rather than trusting that, summon
    // the card for real and compare the damaged set to the drawn set.
    const { drawn, struck } = struckBySummoning("aqua_buccaneers");
    expect(struck.size, "the volley hit nothing — the fixture is wrong").toBeGreaterThan(0);
    expect(struck).toEqual(drawn);
  });

  it("...and never promises more than it delivers (Aftermath)", () => {
    // Subset rather than equality, deliberately and temporarily. Aftermath also
    // carries `farRowDmg`, a SECOND band two rows ahead, and no preview path in
    // the app knows about it yet — it is being added alongside the two-row
    // spells and `smite`, which are the same class of omission.
    //
    // The direction is what matters here and it is the safe one: the preview
    // UNDER-reports, so nothing it draws is a lie. Over-reporting is the bug
    // this change fixed, and this asserts it has not come back. When the far row
    // lands, the two sets become equal and this still passes.
    const { drawn, struck } = struckBySummoning("pyro_aftermath");
    expect(drawn.size, "drew nothing at all").toBeGreaterThan(0);
    for (const cell of drawn) expect(struck, `previewed ${cell} but it took nothing`).toContain(cell);
  });
});

describe("melee vs ranged reach", () => {
  it("melee hits the 8 adjacent squares only (king reach)", () => {
    const s = prepState();
    const melee = place(s, "leaf_alpha", "P1", 2, 1); // Warrior, melee
    const beside = place(s, "dusk_vamp", "P2", 2, 2); // same row, adjacent col
    const diagonal = place(s, "dusk_gool", "P2", 1, 0); // adjacent row + col
    const farCol = place(s, "dusk_ghastly", "P2", 1, 3); // adjacent row, 2 cols away
    const farRow = place(s, "bore_smith", "P2", 0, 1); // two rows away — also P2 home
    expect(canTarget(s, melee, beside)).toBe(true);
    expect(canTarget(s, melee, diagonal)).toBe(true);
    expect(canTarget(s, melee, farCol)).toBe(false); // no cross-board lunges
    expect(canTarget(s, melee, farRow)).toBe(false);
  });

  it("ranged hits any slot (columns never matter)", () => {
    const s = prepState();
    const ranged = place(s, "leaf_fallona", "P1", 2, 0); // Mage
    const far = place(s, "dusk_vamp", "P2", 0, 3);
    expect(canTarget(s, ranged, far)).toBe(true);
  });
});

describe("Home Slot Targeting Rule", () => {
  it("a card in its own Home row cannot target the enemy Home row", () => {
    const s = prepState();
    const mage = place(s, "leaf_fallona", "P1", 3, 0); // ranged, in own home
    const homeSitter = place(s, "dusk_vamp", "P2", 0, 0); // in P2 home
    const midSitter = place(s, "dusk_gool", "P2", 1, 1);
    expect(canTarget(s, mage, homeSitter)).toBe(false); // camping is denied
    expect(canTarget(s, mage, midSitter)).toBe(true); // mid rows are fair game
  });

  it("from a Mid row (or inside the enemy Home row) the enemy Home is targetable", () => {
    const s = prepState();
    const inMid = place(s, "leaf_fallona", "P1", 2, 0); // ranged
    const inTheirHome = place(s, "pyro_firebird", "P1", 0, 1); // melee, beside the sitter
    const homeSitter = place(s, "dusk_gool", "P2", 0, 0);
    expect(canTarget(s, inMid, homeSitter)).toBe(true);
    expect(canTarget(s, inTheirHome, homeSitter)).toBe(true);
  });

  it("an invader in MY home row is targetable from my home row (not an opp-home slot)", () => {
    const s = prepState();
    const defender = place(s, "leaf_alpha", "P1", 3, 0);
    const invader = place(s, "dusk_vamp", "P2", 3, 1); // standing on P1 home, beside us
    expect(canTarget(s, defender, invader)).toBe(true);
  });

  // ── the 5x5 safe zone ──────────────────────────────────────────────────────
  // The rule's mid test was written `row === 1 || row === 2`, which is every
  // row between the homes on a 4x4 and only two of the three on a 5x5. Row 3 —
  // the row ADJACENT to P1's home — counted as neither mid nor home, so an
  // attacker standing directly in front of the player's back line was told it
  // had no valid action. It was asymmetric: the mirrored position (P1 in row 1
  // shooting into P2's home row 0) worked fine, because row 1 IS "mid". Every
  // 5x5 match in the game shipped with a safe zone that only the player could
  // use, and the AI would walk into the home row to attack at all.

  it("5x5: an attacker in row 3 CAN hit the home row it is standing in front of", () => {
    const s = bigPrepState();
    const attacker = place(s, "dusk_gool", "P2", 3, 2);
    const homeSitter = place(s, "leaf_alpha", "P1", 4, 2);
    expect(canTarget(s, attacker, homeSitter)).toBe(true);
  });

  it("5x5: and the mirrored shot still works, so the rule reads the same both ways", () => {
    const s = bigPrepState();
    const attacker = place(s, "leaf_alpha", "P1", 1, 2);
    const homeSitter = place(s, "dusk_gool", "P2", 0, 2);
    expect(canTarget(s, attacker, homeSitter)).toBe(true);
  });

  it("5x5: camping in your OWN home row is still denied — that half was the point", () => {
    // The fix must not become "the home rule does nothing on the big board".
    const s = bigPrepState();
    const camper = place(s, "leaf_fallona", "P1", 4, 0); // ranged, own home
    const homeSitter = place(s, "dusk_vamp", "P2", 0, 0);
    expect(canTarget(s, camper, homeSitter)).toBe(false);
  });

  it("5x5: a beachhead in row 3 counts as reach for SPELLS too", () => {
    // spellReachesEnemyHome asked the same rows-1-and-2 question, so a board
    // presence one step from the enemy home row bought no spell reach at all.
    const s = bigPrepState();
    place(s, "leaf_alpha", "P2", 1, 2);
    const camping = canSpellHitEnemy(s, "P2", place(s, "leaf_alpha", "P1", 4, 0));
    expect(camping, "row 1 is past P2's home (row 0), so it reaches").toBe(true);
  });

  it("a ranged defender sees the WHOLE of its own home row, past the reach cap", () => {
    // The basic-attack reach is 2 king-steps from your own summoning row, so a
    // shooter holding the back line could not answer an invader three columns
    // away — in position, facing the right way, and the rule said no. Home
    // defence now widens the reach along that row only.
    const s = prepState();
    const defender = place(s, "leaf_fallona", "P1", 3, 0); // ranged, own home
    const farInvader = place(s, "dusk_vamp", "P2", 3, 3);  // same row, 3 cols away
    expect(canTarget(s, defender, farInvader, false, true)).toBe(true);
  });

  it("...but only along that row — the reach cap still holds everywhere else", () => {
    // The widening is scoped to the row being defended. A target the same
    // distance away in a MID row is still out of a home shooter's reach, so
    // this buys defence and not board control: King of the Hill's "advance to
    // see further" is untouched.
    const s = prepState();
    const defender = place(s, "leaf_fallona", "P1", 3, 0);
    const offRow = place(s, "dusk_vamp", "P2", 2, 3); // 3 cols away, one row up
    expect(canTarget(s, defender, offRow, false, true)).toBe(false);
  });

  it("...and a nearer invader in the lane still screens the far one", () => {
    // Reach is not sight. The straight-line body screen still applies down the
    // home row, so you deal with what is in front of you first rather than
    // shooting past it.
    const s = prepState();
    const defender = place(s, "leaf_fallona", "P1", 3, 0);
    const nearInvader = place(s, "dusk_gool", "P2", 3, 2);
    const farInvader = place(s, "dusk_vamp", "P2", 3, 3);
    expect(canTarget(s, defender, nearInvader, false, true)).toBe(true);
    expect(canTarget(s, defender, farInvader, false, true)).toBe(false); // screened
  });
});

describe("ignoresHomeRule (Pumpkin's Catapult)", () => {
  it("lobs across the whole board — as a BASIC, over a screen and the home rule", () => {
    const s = prepState();
    const pumpkin = place(s, "dusk_pumpkin", "P2", 0, 0); // its own home, far corner
    const normal = place(s, "dusk_gool", "P2", 0, 1); // ordinary ranged, same spot
    const camper = place(s, "leaf_fallona", "P1", 3, 0); // P1 home row — 3 rows away
    place(s, "leaf_alpha", "P1", 2, 0); // a body screening the lane
    // The basic-attack path (forBasic) is where the ranged-reach cap lived and
    // quietly grounded Catapult. It must clear the cap, the sight screen, AND
    // the home rule — a lobbed shot reaches the whole battlefield.
    expect(canTarget(s, pumpkin, camper, false, true)).toBe(true);
    // an ordinary ranged basic can do none of that from the back corner.
    expect(canTarget(s, normal, camper, false, true)).toBe(false);
    // the non-basic path (unchanged) still reaches too.
    expect(canTarget(s, pumpkin, camper)).toBe(true);
  });
});

describe("FLYING & STEALTH", () => {
  it("FLYING is immune to melee, ranged hits it", () => {
    const s = prepState();
    const melee = place(s, "dusk_vamp", "P2", 1, 0);
    const ranged = place(s, "bore_krysteel", "P2", 1, 1);
    const flyer = place(s, "pyro_fenrir", "P1", 2, 0); // FLYING
    expect(canTarget(s, melee, flyer)).toBe(false);
    expect(canTarget(s, ranged, flyer)).toBe(true);
  });

  it("a grounded flier (ROOT/FREEZE/etc.) can be hit by melee", () => {
    const s = prepState();
    const melee = place(s, "dusk_vamp", "P2", 1, 0); // Melee, adjacent below
    const flyer = place(s, "pyro_fenrir", "P1", 2, 0); // FLYING
    expect(canTarget(s, melee, flyer)).toBe(false); // airborne — melee whiffs
    applyStatus(s, flyer, "ROOT", 2, 0, "LEAF");
    expect(canTarget(s, melee, flyer)).toBe(true); // rooted → grounded → melee lands
    flyer.statuses = [];
    applyStatus(s, flyer, "FREEZE", 2, 0, "AQUA");
    expect(canTarget(s, melee, flyer)).toBe(true); // frozen grounds it too
    // …but a pure damage/vision debuff does NOT pull it out of the air.
    flyer.statuses = [];
    applyStatus(s, flyer, "BURN", 2, 1, "PYRO");
    expect(canTarget(s, melee, flyer)).toBe(false);
  });

  it("STEALTH is untargetable until it attacks, then targetable that round", () => {
    const s = prepState();
    const enemy = place(s, "dusk_vamp", "P2", 2, 0);
    const sneak = place(s, "leaf_darth", "P1", 2, 1); // Shadow Step: STEALTH
    expect(canTarget(s, enemy, sneak)).toBe(false);
    sneak.attackedThisRound = true; // it attacked → revealed for the round
    expect(canTarget(s, enemy, sneak)).toBe(true);
  });

  it("validTargets excludes allies and off-board cards", () => {
    const s = prepState();
    const me = place(s, "leaf_fallona", "P1", 2, 0);
    place(s, "leaf_alpha", "P1", 2, 1);
    place(s, "dusk_gool", "P2", 1, 1);
    const ids = validTargets(s, me.instanceId).map((t) => t.defId);
    expect(ids).toEqual(["dusk_gool"]);
  });
});

describe("ranged reach — 2 king-steps, blocked on straight lines", () => {
  it("reaches every square within 2 king-steps, knight-shapes included", () => {
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 2, 1, { autoMode: "manual" }); // Ranged
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 1 }, "P2")).toBe(true); // 2 straight
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 3 }, "P2")).toBe(true); // 2 diagonal
    // Knight-shaped: one row over, two columns across. Ray-only targeting left
    // these permanently unhittable though they sit 2 steps away — the hole this
    // rule was widened to close.
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 2 }, "P2")).toBe(true);
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 0 }, "P2")).toBe(true);
  });

  it("3 king-steps is still out of reach", () => {
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 0, 0, { autoMode: "manual" });
    expect(rangedCanSee(s, me.pos!, { row: 2, col: 2 }, "P2")).toBe(true);  // exactly 2
    expect(rangedCanSee(s, me.pos!, { row: 3, col: 0 }, "P2")).toBe(false); // 3 straight
    expect(rangedCanSee(s, me.pos!, { row: 1, col: 3 }, "P2")).toBe(false); // 3 across
  });

  it("the reported gap: a Ranger on r1c3 can shoot r2c1", () => {
    // Straight from a real game — Dart Frog on r1c3, Rhyolite on r2c1 and Hillbilly
    // on r0c1 both two king-steps away, and Basic Attack greyed out entirely
    // because neither enemy happened to sit on a ray.
    const s = prepState();
    const frog = place(s, "leaf_dartfrog", "P1", 1, 3, { autoMode: "manual" });
    const rhe = place(s, "bore_rhe", "P2", 2, 1);
    const hillbilly = place(s, "bore_hillbilly", "P2", 0, 1);
    const ids = validTargets(s, frog.instanceId).map((t) => t.instanceId);
    expect(ids).toContain(rhe.instanceId);
    expect(ids).toContain(hillbilly.instanceId);
    // No "still out of range" case here on purpose: r1c3 is off P1's home row,
    // so the King of the Hill reach bonus applies and 3 king-steps covers the
    // whole 4x4. The out-of-range case is tested from a home row instead.
  });

  it("knight-shaped shots arc — nothing can screen them", () => {
    // No single square sits between r1c3 and r2c1, so there is nothing for a
    // body to stand on. Occupying both plausible paths must not block it.
    const s = prepState();
    const frog = place(s, "leaf_dartfrog", "P1", 1, 3, { autoMode: "manual" });
    const rhe = place(s, "bore_rhe", "P2", 2, 1);
    place(s, "leaf_alpha", "P1", 1, 2);
    place(s, "leaf_greegon", "P1", 2, 2);
    expect(validTargets(s, frog.instanceId).map((t) => t.instanceId)).toContain(rhe.instanceId);
  });

  it("a body on the ray blocks the shot beyond it — and IS the target", () => {
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 3, 1, { autoMode: "manual" });
    const near = place(s, "leaf_alpha", "P1", 2, 1);  // directly ahead, 1 away
    const far = place(s, "leaf_greegon", "P1", 1, 1); // 2 ahead, behind `near`
    const ids = validTargets(s, me.instanceId).map((t) => t.instanceId);
    expect(ids).toContain(near.instanceId);     // the blocker is hittable
    expect(ids).not.toContain(far.instanceId);  // screened
  });

  it("allies do NOT block — you shoot straight past your own front line", () => {
    // Chess would screen here, but you advance into your own firing lane
    // constantly, and an archer silently disarmed by its own tank reads as a
    // bug rather than a tactic.
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 3, 1, { autoMode: "manual" });
    place(s, "dusk_gool", "P2", 2, 1); // an ALLY standing squarely in the lane
    const far = place(s, "leaf_greegon", "P1", 1, 1);
    expect(validTargets(s, me.instanceId).map((t) => t.instanceId)).toContain(far.instanceId);
  });

  it("an ally and an enemy on the same square-count behave differently", () => {
    // Same geometry, same distance — only the blocker's side changes.
    const build = (blockerOwner: "P1" | "P2") => {
      const s = prepState();
      const me = place(s, "dusk_ghastly", "P2", 3, 1, { autoMode: "manual" });
      place(s, blockerOwner === "P2" ? "dusk_gool" : "leaf_alpha", blockerOwner, 2, 1);
      const far = place(s, "leaf_greegon", "P1", 1, 1);
      return validTargets(s, me.instanceId).map((t) => t.instanceId).includes(far.instanceId);
    };
    expect(build("P2")).toBe(true);  // ally in the lane — shot goes past
    expect(build("P1")).toBe(false); // enemy in the lane — shot is stopped
  });

  it("specials are exempt — they keep the full board", () => {
    const s = prepState();
    s.players.P2.magicPool = 20;
    // On its OWN home row, so reach stays 2 — otherwise the advanced bonus puts
    // the whole 4x4 inside basic range and there is nothing left to compare.
    const me = place(s, "dusk_ghastly", "P2", 0, 0, { autoMode: "manual" });
    const offRay = place(s, "leaf_greegon", "P1", 2, 3); // 3 king-steps away
    expect(validTargets(s, me.instanceId).map((t) => t.instanceId)).not.toContain(offRay.instanceId);
    // …but the Special still reaches it.
    expect(validSpecialTargets(s, me.instanceId).map((t) => t.instanceId)).toContain(offRay.instanceId);
  });

  it("melee is untouched — still king's move, still 1 space", () => {
    const s = prepState();
    const me = place(s, "leaf_sticks", "P1", 2, 1, { autoMode: "manual" }); // Melee
    const beside = place(s, "dusk_gool", "P2", 1, 2);
    const twoAway = place(s, "dusk_vamp", "P2", 0, 1); // on a ray, but 2 out
    const ids = validTargets(s, me.instanceId).map((t) => t.instanceId);
    expect(ids).toContain(beside.instanceId);
    expect(ids).not.toContain(twoAway.instanceId);
  });
});

describe("King of the Hill — reach", () => {
  const reachOf = (row: number) => {
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", row, 0, { autoMode: "manual" }); // Ranged
    return rangedReachFor(s, me);
  };

  it("a Ranged card gains +1 reach once it leaves its own summoning row", () => {
    // P2 summons into row 0. Sitting there is short-sighted; anywhere else is
    // "advanced" — including deep in enemy territory.
    expect(reachOf(0)).toBe(2); // own home row
    expect(reachOf(1)).toBe(3);
    expect(reachOf(2)).toBe(3);
    expect(reachOf(3)).toBe(3); // the ENEMY home row still counts as advanced
  });

  it("it is the card's OWN row that matters, not a fixed row number", () => {
    // P1 summons into row 3, so the rows are mirrored for it.
    const s = prepState();
    const p1 = place(s, "leaf_dartfrog", "P1", 3, 0, { autoMode: "manual" });
    const p2 = place(s, "dusk_ghastly", "P2", 3, 1, { autoMode: "manual" });
    expect(rangedReachFor(s, p1)).toBe(2); // row 3 IS P1's home
    expect(rangedReachFor(s, p2)).toBe(3); // same row, but advanced for P2
  });

  it("the extra square is real: a 3-step target is reachable only when advanced", () => {
    const build = (row: number) => {
      const s = prepState();
      const me = place(s, "dusk_ghastly", "P2", row, 0, { autoMode: "manual" });
      const far = place(s, "leaf_greegon", "P1", row === 0 ? 2 : 3, 3); // 3 steps out
      return validTargets(s, me.instanceId).map((t) => t.instanceId).includes(far.instanceId);
    };
    expect(build(0)).toBe(false); // on the summoning row — 3 is too far
    expect(build(1)).toBe(true);  // advanced — the third step lands
  });

  it("melee gains nothing — it keeps king-step adjacency", () => {
    const s = prepState();
    const melee = place(s, "leaf_sticks", "P1", 1, 1, { autoMode: "manual" }); // advanced Melee
    const adjacent = place(s, "dusk_gool", "P2", 0, 1);
    const twoAway = place(s, "dusk_vamp", "P2", 1, 3);
    const ids = validTargets(s, melee.instanceId).map((t) => t.instanceId);
    expect(ids).toContain(adjacent.instanceId);
    expect(ids).not.toContain(twoAway.instanceId); // still 1 space, bonus or not
  });
});

describe("a Special that charges can aim as far as it charges", () => {
  /** Put the caster in its home row and the only enemy `gap` columns away on the
   *  row ahead — the shape every one of these cards is printed for. */
  function apart(defId: string, gap: number) {
    const s = prepState();
    s.players.P1.magicPool = 20;
    const a = place(s, defId, "P1", 3, 0);
    const t = place(s, "bore_armadillo", "P2", 2, gap, { curHp: 40, maxHp: 40 });
    return { s, a, t };
  }

  it("Stormfang can pick a target across the board — its dash is 4", () => {
    const { s, a } = apart("gale_stormfang", 3);
    expect(specialTargets(s, a.instanceId).length).toBe(1);
    expect(canFireSpecial(s, a.instanceId).ok).toBe(true);
  });

  it("and actually moves when it does", () => {
    const { s, a, t } = apart("gale_stormfang", 3);
    const next = applyIntent(
      { ...s, phase: "battle", prep: null, battle: { queue: [a.instanceId], index: 0, awaitingInput: a.instanceId } },
      { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: t.instanceId },
    );
    const moved = next.cards[a.instanceId].pos!;
    expect(moved, "the dash covered ground").not.toEqual({ row: 3, col: 0 });
    expect(next.cards[t.instanceId].curHp).toBeLessThan(40);
  });

  it("Razor Guard's reach grows by ONE, not to the whole board — its charge is 1", () => {
    // The blunt fix for this class is `ranged: true`, and it would have been
    // wrong here: strike does not re-check reach after the charge, so Dande
    // would deal its damage from anywhere. Two columns is inside the dash; three
    // is not.
    expect(specialTargets(apart("leaf_dande", 2).s, apart("leaf_dande", 2).a.instanceId).length).toBe(1);
    const far = apart("leaf_dande", 3);
    expect(specialTargets(far.s, far.a.instanceId).length).toBe(0);
  });

  it("a ground charger still cannot pull a flier down", () => {
    const s = prepState();
    s.players.P1.magicPool = 20;
    const a = place(s, "gale_stormfang", "P1", 3, 0);
    place(s, "gale_gastly", "P2", 2, 3, { curHp: 20, maxHp: 20 }); // FLYING
    const picks = specialTargets(s, a.instanceId);
    expect(picks.filter((p) => getDef(p.defId).keywords.FLYING)).toHaveLength(0);
  });

  it("Brute's Sweep will NOT fire at a row-ahead enemy three columns away", () => {
    // Inverted, and deliberately. Sweep used to take the whole row ahead, which
    // is a set the ordinary melee fire gate cannot see — so the Special carried
    // `ranged: true` purely to stop canFireSpecial refusing it, and gate and
    // effect described different things.
    //
    // Sweep now hits everything in RANGE (`validTargets`, the same list a basic
    // offers), so the melee gate is exactly the right gate. An enemy three
    // columns away in the row ahead is no longer something Sweep would touch,
    // and firing at it would spend 3 magic on an empty swing. See
    // brute-sweep.test.ts for what it does hit.
    const { s, a } = apart("dusk_brute", 3);
    expect(canFireSpecial(s, a.instanceId).ok).toBe(false);
    // And it still fires when something IS in reach — the gate did not simply
    // become "never", which is the way this fix could quietly go wrong.
    const near = apart("dusk_brute", 1);
    expect(canFireSpecial(near.s, near.a.instanceId).ok).toBe(true);
  });
});

describe("Wind Warp: distance is no object, the Home rule still is", () => {
  function warper(row: 0 | 1 | 2 | 3, col: 0 | 1 | 2 | 3) {
    const s = prepState();
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const a = place(s, "gale_rayfen", "P1", row, col);
    return { s, a };
  }

  it("moves clear across the board, well past its own reach", () => {
    const { s, a } = warper(2, 0);
    expect(canMove(s, "P1", a.instanceId, { row: 0, col: 3 }).ok).toBe(true);
  });

  it("an ordinary card of the same speed cannot", () => {
    // The control: without the passive, that same distance is refused.
    const s = prepState();
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    const plain = place(s, "gale_megair", "P1", 2, 0);
    expect(canMove(s, "P1", plain.instanceId, { row: 0, col: 3 }).ok).toBe(false);
  });

  it("still cannot cross from its own Home row to the enemy's in one move", () => {
    const { s, a } = warper(3, 0); // P1's home row
    const r = canMove(s, "P1", a.instanceId, { row: 0, col: 2 }); // P2's home row
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Home row/);
  });

  it("and obeys every other rule — occupied, captured, pinned", () => {
    const { s, a } = warper(2, 0);
    place(s, "dusk_gool", "P2", 0, 3, { curHp: 20, maxHp: 20 });
    expect(canMove(s, "P1", a.instanceId, { row: 0, col: 3 }).ok, "occupied").toBe(false);

    const cap = warper(2, 0);
    cap.s.slots[0][2].capturedBy = "P2";
    expect(canMove(cap.s, "P1", cap.a.instanceId, { row: 0, col: 2 }).ok, "captured").toBe(false);

    const pinned = warper(2, 0);
    applyStatus(pinned.s, pinned.s.cards[pinned.a.instanceId], "ROOT", 2, 0, "LEAF");
    expect(canMove(pinned.s, "P1", pinned.a.instanceId, { row: 0, col: 3 }).ok, "rooted").toBe(false);
  });
});

describe("a lane weapon has to be able to reach the lane", () => {
  it("no MELEE Special filters to sameColumn without ranged, reach or a charge", () => {
    // THE BUG THIS CATCHES, twice over. `sameColumn` (and rowAhead, and
    // enemyHomeRow) FILTER the targets the targeting layer already chose — they
    // do not rescan the board. On a Melee card with no reach, the chosen set is
    // the 8-square melee box, so filtering it to one column leaves the single
    // card standing directly ahead. Anything whose text promises a LANE is then
    // lying.
    //
    // Xilty's Web Trap shipped like this (statusNova, no reach at all) and read
    // as "trash" on the device; auditing the rest of the tower for the same
    // omission found Vulcanyx's Fissure promising "through everything in the
    // column ahead" and hitting one card. `reach` is a GENERIC Special param
    // that validSpecialTargets honours for every handler, and `ranged` lifts
    // the melee limit entirely — a lane weapon needs one of them.
    //
    // rowAhead is deliberately NOT included: the melee box already contains the
    // three squares in the row ahead, so that filter yields three targets and
    // means exactly what it says (Blackice, Sakuroot, Killer Whale).
    const offenders: string[] = [];
    for (const def of CARDS) {
      const sp = def.special;
      if (!sp || def.attackType !== "Melee") continue;
      const params = (sp.params ?? {}) as Record<string, unknown>;
      if (!Number(params.sameColumn ?? 0)) continue;
      if (sp.ranged) continue;
      if (Number(params.reach ?? 0) > 1) continue;
      if (Number(params.charge ?? 0) > 0) continue; // it closes the distance itself
      offenders.push(`${def.id} (${sp.name})`);
    }
    expect(offenders, "melee lane weapons that cannot reach their lane").toEqual([]);
  });
});


// Reported together, and they turned out to be one bug: `specialTargets`
// measured from the CASTER's reach even when the caster is not the one who has
// to reach. A card whose Special is useful with nothing in its own range had
// its turn skipped for "No valid target".
describe("a Special is gated on who actually reaches — the swarm does the reaching", () => {
  it("lets Sarachnid send the spiders that CAN reach, when she cannot", () => {
    // Silk Chase says "every allied Spider attacks". Standing her a square too
    // far back with her spiders already on top of somebody refused the ability
    // and skipped her turn, with a board full of allies who could all have swung.
    const s = prepState(5);
    const sar = place(s, "dusk_sarachnid", "P1", 3, 0);
    place(s, "dusk_spider", "P1", 1, 3);                        // beside the foe
    place(s, "pyro_staph", "P2", 0, 3, { curHp: 90, maxHp: 90 });
    s.players.P1.magicPool = 10;
    expect(specialTargets(s, sar.instanceId).length, "the spider's reach counts").toBe(1);
    expect(canFireSpecial(s, sar.instanceId).ok).toBe(true);
  });

  it("still refuses when NOBODY in the swarm can reach", () => {
    // The control, and the reason this is a widening rather than a hole: with no
    // spider on the board the ability is genuinely useless and must stay refused,
    // or the card burns 2 magic to do nothing.
    const s = prepState(5);
    const sar = place(s, "dusk_sarachnid", "P1", 3, 0);
    place(s, "pyro_staph", "P2", 0, 3, { curHp: 90, maxHp: 90 });
    s.players.P1.magicPool = 10;
    expect(specialTargets(s, sar.instanceId)).toEqual([]);
    expect(canFireSpecial(s, sar.instanceId).ok).toBe(false);
  });

  it("lets Bolder's Vengeance answer the shooter that hurt it", () => {
    // Iron Ore halves Ranger and Assassin damage, so what actually hurts Bolder
    // is usually standing as far away as it can. Gated on the melee square, the
    // retaliation was refused in exactly the situation the card exists for.
    const s = prepState(5);
    const b = place(s, "bore_bolder", "P1", 3, 1);
    place(s, "pyro_staph", "P2", 1, 3, { curHp: 90, maxHp: 90, curShields: 0 });
    b.dmgTakenThisRound = 9;
    s.players.P1.magicPool = 10;
    expect(specialTargets(s, b.instanceId).length).toBeGreaterThan(0);
    expect(canFireSpecial(s, b.instanceId).ok).toBe(true);
  });

  it("reflects exactly what Bolder took this round", () => {
    // The handler direct: there is no SPECIAL intent (it is BATTLE_ACTION, which
    // needs a live battle phase already awaiting this card), and what is worth
    // pinning here is the arithmetic, not the plumbing that reaches it.
    const s = prepState(5);
    const b = place(s, "bore_bolder", "P1", 3, 1);
    const foe = place(s, "pyro_staph", "P2", 1, 3, { curHp: 90, maxHp: 90, curShields: 0 });
    b.dmgTakenThisRound = 9;
    SPECIAL_HANDLERS.vengeance(s, s.cards[b.instanceId], [s.cards[foe.instanceId]], { sleep: 2 });
    expect(s.cards[foe.instanceId].curHp, "9 back, PEN").toBe(81);
    expect((s.cards[foe.instanceId].statuses ?? []).map((x) => x.kind)).toContain("SLEEP");
  });

  it("gives Bolder the TRAMPLE it was asked for, with a crush like every carrier", () => {
    const d = getDef("bore_bolder");
    expect(d.keywords.TRAMPLE).toBe(true);
    expect(d.trampleDmg, "a third of its 6 DMG, the ratio the others took").toBe(2);
  });
});
