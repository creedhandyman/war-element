// A Talent with nothing to aim at is not an action.
//
// `canFireSpecial` has refused an empty target list since it was written ("No
// valid target"). `canFireTalent` never got the same line, so a Talent staring
// at an empty board was still offered — and firing it marked `talentUsed`, did
// nothing, and logged nothing to say why. Once per game, gone.
//
// That is the same failure `talentTargets` was written to fix for Stone's
// Search and Rescue, which was handed the ENEMY list for an ally-targeting
// ability. The targeting was corrected then and the GATE was not, so the bug
// survived in its other half.
//
// The hard part is not the gate, it is knowing WHICH talents need a target.
// Most of them read the list; several read only the caster; and two build their
// own victims from a param. Guessing that would have broken eight cards, so it
// is derived and then pinned.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import {
  canFireTalent, talentNeedsTarget, TALENT_EXCLUDES_SELF, TALENT_NEEDS_NO_TARGET,
} from "../rules";
import { place, prepState } from "./helpers";

const COMBAT = readFileSync(join(__dirname, "..", "combat.ts"), "utf8");

/** A lone card of `id`, with nothing else on the board. */
const alone = (id: string) => {
  const s = prepState();
  const c = place(s, id, "P1", 3, 1);
  return { s, id: c.instanceId };
};

describe("a Talent that needs a target is refused without one", () => {
  it("Eye of the Gyre will not fire at an empty board", () => {
    const { s, id } = alone("gale_gyre");
    const r = canFireTalent(s, id);
    expect(r.ok, "offered with nothing to drag").toBe(false);
    expect(r.reason).toBe("No valid target");
  });

  it("...and fires the moment there is something to drag", () => {
    const { s, id } = alone("gale_gyre");
    place(s, "leaf_alpha", "P2", 2, 1);
    expect(canFireTalent(s, id).ok).toBe(true);
  });

  it("Search and Rescue needs an ALLY, not an enemy", () => {
    // The original bug's card. It swaps places with an ally, so a board full of
    // enemies is still nothing to aim at.
    const { s, id } = alone("bore_stone");
    place(s, "leaf_alpha", "P2", 2, 1);
    expect(canFireTalent(s, id).ok, "an enemy is not an ally").toBe(false);
    place(s, "leaf_alpha", "P1", 3, 2);
    expect(canFireTalent(s, id).ok, "and an ally is").toBe(true);
  });
});

describe("...but a Talent that needs nothing is still offered", () => {
  // The half a blanket gate would have broken. Every one of these reads only
  // the caster or builds its own list, so an empty enemy board says nothing
  // about whether it can act.
  it.each([
    ["gale_hawk", "Glide Rush — empower, reads only the caster"],
    ["bore_dunebuggy", "Redline — empower"],
    ["aqua_tide", "Shell Tuck — shellTuck"],
    ["bolt_buzz", "Electro Surge — electroSurge"],
    ["leaf_oak", "Reroot — reposition"],
    ["leaf_dartfrog", "Bleed Out — loadHits, dispatched inline"],
    ["gale_tumbleweed", "Roll Through — prints 'roll even with nothing to hit'"],
    ["bolt_handyman", "Patch Job — grantShield builds its crew from allies"],
  ])("%s: %s", (id) => {
    const { s, id: inst } = alone(id);
    expect(canFireTalent(s, inst).ok, `${id} was blocked with an empty board`).toBe(true);
  });
});

describe("the no-target list is derived, not remembered", () => {
  it("matches the handlers that actually ignore their target list", () => {
    // The convention is the source of truth: a handler names the parameter
    // `_targets` when it does not read it. `loadHits` is the one addition — the
    // talent dispatcher handles it inline and never passes a list at all.
    const ignoring = new Set(
      [...COMBAT.matchAll(/^ {2}(\w+)\(draft, attacker, _targets/gm)].map((m) => m[1]),
    );
    expect(ignoring.size, "the scanner found no handlers — it is broken, not the list")
      .toBeGreaterThan(3);

    const talentHandlers = new Set(
      [...CARDS, ...TOKENS].filter((d) => d.talent).map((d) => d.talent!.handler),
    );
    // Only the ones a talent actually uses: the registry is far bigger, and a
    // self-affecting handler no talent names is not this list's business.
    const want = new Set([...talentHandlers].filter((h) => ignoring.has(h)));
    want.add("loadHits");
    expect([...TALENT_NEEDS_NO_TARGET].sort()).toEqual([...want].sort());
  });

  it("knows which handlers cannot aim at the caster", () => {
    // `validAllyTargets` hands back the whole side, caster included — right for
    // a self-heal, wrong for a swap. Derived from the handlers that actually
    // filter the caster out, so the list cannot drift from the code it
    // describes.
    const excluding = new Set(
      [...COMBAT.matchAll(/^ {2}(\w+)\(draft, attacker, targets[\s\S]{0,700}?instanceId !== attacker\.instanceId/gm)]
        .map((m) => m[1]),
    );
    const talentHandlers = new Set(
      [...CARDS, ...TOKENS].filter((d) => d.talent).map((d) => d.talent!.handler),
    );
    const want = [...excluding].filter((h) => talentHandlers.has(h)).sort();
    expect(want.length, "the scanner found none — it is broken, not the list")
      .toBeGreaterThan(0);
    expect([...TALENT_EXCLUDES_SELF].sort()).toEqual(want);
  });

  it("every talent handler is one or the other, on purpose", () => {
    // A new talent handler lands in "needs a target" by default, which is the
    // safe side — it refuses rather than wasting the charge. This is here so
    // the decision is visible rather than inherited.
    for (const d of [...CARDS, ...TOKENS]) {
      if (!d.talent) continue;
      const needs = talentNeedsTarget(d);
      expect(typeof needs, `${d.id}`).toBe("boolean");
      if (!needs)
        expect(
          TALENT_NEEDS_NO_TARGET.has(d.talent.handler)
            || Number(d.talent.params?.rollThrough ?? 0) > 0
            || Number(d.talent.params?.nearby ?? 0) > 0,
          `${d.id} skips the gate for no stated reason`,
        ).toBe(true);
    }
  });

  it("the ones that DO need a target are the majority", () => {
    const all = [...CARDS, ...TOKENS].filter((d) => d.talent);
    const needing = all.filter((d) => talentNeedsTarget(d));
    expect(needing.length).toBeGreaterThan(all.length / 2);
    expect(needing.length, "and not all of them — the exemptions are real")
      .toBeLessThan(all.length);
    expect(needing.some((d) => d.id === "gale_gyre")).toBe(true);
  });
});

describe("the card's own text agrees with the gate", () => {
  it("Roll Through is exempt because it says so out loud", () => {
    const t = getDef("gale_tumbleweed").talent!;
    expect(t.text.toLowerCase()).toContain("nothing to hit");
    expect(talentNeedsTarget(getDef("gale_tumbleweed"))).toBe(false);
  });
});
