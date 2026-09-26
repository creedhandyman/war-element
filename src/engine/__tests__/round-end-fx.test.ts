import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import type { GameState, StatusEffect } from "../types";
import { cardAttack, cardAttackEffects, lookVariant, roundEndEffects, type SpellFx } from "../../ui/vfx/spell-fx";
import { atBattle, place, prepState } from "./helpers";

type Tick = Extract<SpellFx, { kind: "tick" }>;
const ticks = (fx: SpellFx[]) => fx.filter((f): f is Tick => f.kind === "tick");
const sq = (f: { at: { row: number; col: number } }) => `${f.at.row},${f.at.col}`;
const status = (kind: StatusEffect["kind"], duration: number, power = 0): StatusEffect =>
  ({ kind, duration, power, source: "AQUA" });

/** Stand the battle at its end: every card has acted, so the next advance()
 *  is the one step that runs Cleanup. */
function endOfRound(s: GameState): GameState {
  const b = atBattle(s);
  b.battle!.index = b.battle!.queue.length;
  return b;
}

describe("the end of the round, drawn status by status", () => {
  it("each DOT a card carries bites it, BURN melting the plating it wore; then the heal", () => {
    let s = prepState(2);
    place(s, "leaf_greegon", "P1", 2, 0, { curHp: 9, curShields: 2, status: status("BURN", 2, 2) });
    place(s, "leaf_greegon", "P2", 1, 3, { curHp: 9, status: status("DOT", 2, 2) });
    place(s, "leaf_greegon", "P2", 0, 0); // full HP, nothing on it: nothing to draw
    s = endOfRound(s);
    const fx = ticks(roundEndEffects(s, advance(s)));
    const bites = fx.filter((f) => f.tick === "bite");
    expect(bites.map((f) => `${sq(f)} ${f.status}${f.melted ? " melted" : ""}`).sort()).toEqual(["1,3 DOT", "2,0 BURN melted"]);
    // Cleanup's order, as a stagger: the bites land first...
    expect(bites.every((f) => f.delay === 0)).toBe(true);
    // ...then the heal. Greegon takes 2 BURN and REGENERATES 2 in this same
    // step, ending on the HP it started with — it still healed, and a LEAF
    // card's heal is its Photosynthesis.
    const heal = fx.find((f) => sq(f) === "2,0" && f.tick === "photosynthesis");
    expect(heal?.delay).toBeGreaterThan(0);
    expect(fx.some((f) => sq(f) === "0,0")).toBe(false);
  });

  it("a status that runs out ends — the freeze shatters — and one with rounds left does not", () => {
    let s = prepState(2);
    place(s, "aqua_misty", "P1", 2, 0, { status: status("FREEZE", 1) });
    place(s, "aqua_misty", "P1", 2, 2, { status: status("FREEZE", 2) });
    s = endOfRound(s);
    const fx = ticks(roundEndEffects(s, advance(s)));
    expect(fx.filter((f) => f.tick === "expire").map((f) => `${sq(f)} ${f.status}`)).toEqual(["2,0 FREEZE"]);
  });

  it("DAWN's light burns off the oldest affliction — a cleanse, not an ending — and the rest run out after", () => {
    let s = prepState(2);
    const ox = place(s, "dawn_musk_ox", "P1", 2, 1);
    ox.statuses = [status("WEAKEN", 3, 1), status("BLIND", 1)];
    s = endOfRound(s);
    const fx = ticks(roundEndEffects(s, advance(s))).filter((f) => sq(f) === "2,1");
    const cleanse = fx.find((f) => f.tick === "cleanse");
    const ended = fx.find((f) => f.tick === "expire");
    expect(cleanse?.status).toBe("WEAKEN");
    expect(ended?.status).toBe("BLIND");
    expect(ended!.delay).toBeGreaterThan(cleanse!.delay);
  });

  it("Creeping Dark draws from the weakest card the DUSK card touches, back to itself", () => {
    let s = prepState(2);
    place(s, "dusk_vamp", "P1", 2, 1);
    place(s, "leaf_greegon", "P2", 1, 1, { curHp: 3 });
    place(s, "leaf_greegon", "P2", 1, 2, { curHp: 6 });
    s = endOfRound(s);
    const drains = roundEndEffects(s, advance(s)).filter((f) => f.kind === "drain");
    expect(drains).toEqual([expect.objectContaining({ from: { row: 1, col: 1 }, to: { row: 2, col: 1 } })]);
  });

  it("draws nothing for any step but the round's end", () => {
    const s = prepState(2);
    const a = place(s, "aqua_misty", "P1", 2, 0, { status: status("BURN", 1, 2) });
    s.phase = "battle";
    s.battle = { queue: [a.instanceId], index: 0, awaitingInput: null };
    expect(roundEndEffects(s, structuredClone(s))).toEqual([]);
  });
});

describe("an icy AQUA card attacks in ice", () => {
  it("is read off the card: the Frozen Flow, a kit that freezes, a name for the cold", () => {
    const s = prepState(1);
    expect(lookVariant(place(s, "aqua_misty", "P1", 3, 0))).toBeUndefined();
    expect(lookVariant(place(s, "aqua_misty", "P1", 3, 1, { flowMode: "ice" }))).toBe("ice");
    expect(lookVariant(place(s, "aqua_polarking", "P1", 3, 2))).toBe("ice"); // freezes whoever strikes it
    expect(lookVariant(place(s, "aqua_icyninza", "P1", 3, 3))).toBe("ice"); // Frostveil: the name alone
    expect(lookVariant(place(s, "aqua_blackice", "P2", 0, 0))).toBe("ice"); // the cold word closing a name
    expect(lookVariant(place(s, "leaf_greegon", "P2", 0, 1, { flowMode: "ice" }))).toBeUndefined(); // AQUA's only
  });

  it("carries it from the attack down to every hit it lands", () => {
    const s = prepState(1);
    const polar = place(s, "aqua_polarking", "P1", 2, 1);
    const foe = place(s, "leaf_greegon", "P2", 1, 1);
    s.phase = "battle";
    s.battle = { queue: [polar.instanceId], index: 0, awaitingInput: null };
    const after = structuredClone(s);
    after.battle!.index = 1;
    after.cards[foe.instanceId].curHp -= 3;
    expect(cardAttack(s, after)?.variant).toBe("ice");
    const hits = cardAttackEffects(s, after).filter((f) => f.kind === "hit");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ variant: "ice" });
  });
});
