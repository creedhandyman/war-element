import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import type { GameState } from "../types";
import { cardAttack, cardAttackEffects, type SpellFx } from "../../ui/vfx/spell-fx";
import { SIGNATURES } from "../../ui/vfx/signatures";
import { CARDS } from "../../data/cards";
import { atBattle, place, prepState } from "./helpers";

// A MYTHIC's Special — and the strike it makes as it lands — is drawn as its
// own signature move (vfx/signatures/). What the drawing is handed is read off
// the step like everything else: who aimed at what, what that cost, who died,
// where the card ended up, what it raised.

/** A battle step by `attackerId`, with `after` left for the test to shape. */
function step(s: GameState, attackerId: string) {
  s.phase = "battle";
  s.battle = { queue: [attackerId], index: 0, awaitingInput: null };
  const after = structuredClone(s);
  after.battle!.index = 1;
  return after;
}
type Sig = Extract<SpellFx, { kind: "signature" }>;
const sigOf = (fx: SpellFx[]) => fx.filter((f): f is Sig => f.kind === "signature");
const hurt = (s: GameState, id: string, n: number) => {
  const c = s.cards[id];
  c.curHp -= n;
  c.fxDmgHits = [...(c.fxDmgHits ?? []), n];
  c.fxDmgSeq = (c.fxDmgSeq ?? 0) + 1;
};

describe("a mythic's signature move", () => {
  it("its Special is its signature: keyed by card, with what it hit, what that cost, and who died", () => {
    const s = prepState(1);
    const k = place(s, "aqua_kraken", "P2", 1, 1);
    const a = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 20, curShields: 0 });
    const b = place(s, "leaf_greegon", "P1", 3, 2, { curHp: 3, curShields: 0 });
    const after = step(s, k.instanceId);
    after.cards[k.instanceId].specialCasts += 1;
    hurt(after, a.instanceId, 8);
    delete after.cards[b.instanceId];
    const [sig] = sigOf(cardAttackEffects(s, after));
    expect(sig).toMatchObject({ key: "aqua_kraken", element: "AQUA", actor: { row: 1, col: 1 }, lands: { row: 1, col: 1 }, arriving: false });
    const by = Object.fromEntries(sig.targets.map((t, i) => [`${t.row},${t.col}`, [sig.damage[i], sig.killed[i]]]));
    expect(by).toEqual({ "2,1": [8, false], "3,2": [3, true] });
    expect(cardAttack(s, after)?.signature).toBe("aqua_kraken");
  });

  it("points ahead toward its enemy: down the rows for P2, up them for P1", () => {
    const s = prepState(1);
    const k = place(s, "aqua_kraken", "P2", 1, 1);
    const t = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 20 });
    const after = step(s, k.instanceId);
    after.cards[k.instanceId].specialCasts += 1;
    hurt(after, t.instanceId, 8);
    expect(sigOf(cardAttackEffects(s, after))[0].dir).toBe(1);
    const s2 = prepState(1);
    const k2 = place(s2, "aqua_kraken", "P1", 2, 1);
    const t2 = place(s2, "leaf_greegon", "P2", 1, 1, { curHp: 20 });
    const after2 = step(s2, k2.instanceId);
    after2.cards[k2.instanceId].specialCasts += 1;
    hurt(after2, t2.instanceId, 8);
    expect(sigOf(cardAttackEffects(s2, after2))[0].dir).toBe(-1);
  });

  it("a basic attack is not its signature — only the move it is known for", () => {
    const s = prepState(1);
    const k = place(s, "aqua_kraken", "P2", 1, 1);
    const t = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 20 });
    const after = step(s, k.instanceId);
    hurt(after, t.instanceId, 4);
    expect(sigOf(cardAttackEffects(s, after))).toEqual([]);
    expect(cardAttack(s, after)?.signature).toBeUndefined();
  });

  it("nor is any other card's Special, however grand", () => {
    const s = prepState(1);
    const b = place(s, "aqua_blackice", "P2", 1, 1);
    const t = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 20 });
    const after = step(s, b.instanceId);
    after.cards[b.instanceId].specialCasts += 1;
    hurt(after, t.instanceId, 9);
    expect(sigOf(cardAttackEffects(s, after))).toEqual([]);
  });

  it("a charge, a dive or a ride ends somewhere else: the signature knows where", () => {
    const s = prepState(1);
    const h = place(s, "dusk_shadowhorsemen", "P2", 0, 1);
    const t = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 30 });
    const after = step(s, h.instanceId);
    after.cards[h.instanceId].specialCasts += 1;
    after.cards[h.instanceId].pos = { row: 2, col: 1 };
    hurt(after, t.instanceId, 19);
    expect(sigOf(cardAttackEffects(s, after))[0].lands).toEqual({ row: 2, col: 1 });
    expect(cardAttack(s, after)?.lands).toEqual({ row: 2, col: 1 });
  });

  it("a Special aimed at nothing (a self-buff) is still the move itself", () => {
    const s = prepState(1);
    const o = place(s, "leaf_oakgre", "P2", 0, 1);
    const after = step(s, o.instanceId);
    const me = after.cards[o.instanceId];
    me.specialCasts += 1;
    me.curHp -= 9;
    me.dmgBonus += 3;
    me.spBonus += 3;
    expect(cardAttack(s, after)).toBeNull(); // nothing to deliver at...
    const [sig] = sigOf(cardAttackEffects(s, after)); // ...but it lands
    expect(sig).toMatchObject({ key: "leaf_oakgre", targets: [], damage: [], killed: [] });
  });

  it("what it raised, and who stands with it", () => {
    const s = prepState(1);
    const imp = place(s, "dawn_imperator", "P2", 0, 1);
    place(s, "leaf_greegon", "P2", 0, 3);
    const after = step(s, imp.instanceId);
    after.cards[imp.instanceId].specialCasts += 1;
    after.cards.heir = { ...structuredClone(after.cards[imp.instanceId]), instanceId: "heir", defId: "dawn_heir_tok", pos: { row: 0, col: 2 } };
    const [sig] = sigOf(cardAttackEffects(s, after));
    expect(sig.spawned).toEqual([{ row: 0, col: 2 }]);
    expect(sig.allies).toEqual(expect.arrayContaining([{ row: 0, col: 2 }, { row: 0, col: 3 }]));
    expect(sig.allies).toHaveLength(2);
  });

  it("the strike a mythic makes as it lands is its signature too, from its square", () => {
    const s = prepState(1);
    const t = place(s, "leaf_greegon", "P1", 2, 1, { curHp: 30 });
    const after = structuredClone(s);
    place(after, "pyro_pyrogon", "P2", 0, 1);
    hurt(after, t.instanceId, 7);
    const [sig] = sigOf(cardAttackEffects(s, after));
    expect(sig).toMatchObject({ key: "pyro_pyrogon", actor: { row: 0, col: 1 }, arriving: true });
    expect(cardAttack(s, after)).toMatchObject({ signature: "pyro_pyrogon", arriving: true });
  });

  it("through the real engine: Kraken's Black Wave Crash is drawn as Kraken's", () => {
    let s = prepState(3);
    place(s, "aqua_kraken", "P2", 1, 1, { autoMode: "full" });
    for (const col of [0, 1, 2]) place(s, "leaf_greegon", "P1", 2, col, { curHp: 30, maxHp: 30, curShields: 0, autoMode: "full" });
    s.players.P2.magicPool = 20;
    s = atBattle(s);
    s.players.P2.magicPool = 20;
    for (let i = 0; i < 16 && s.phase === "battle"; i++) {
      const next = advance(s);
      const sig = sigOf(cardAttackEffects(s, next))[0];
      if (sig) {
        expect(sig.key).toBe("aqua_kraken");
        expect(sig.targets.length).toBeGreaterThanOrEqual(2);
        return;
      }
      s = next;
    }
    throw new Error("Kraken never fired Black Wave Crash");
  });

  it("every drawn signature is a real mythic, keyed by its card id", () => {
    const mythic = new Set(CARDS.filter((c) => c.rarity === "mythic").map((c) => c.id));
    for (const key of Object.keys(SIGNATURES)) expect(mythic.has(key)).toBe(true);
  });

  it("every mythic — each collectible and each boss — fires its own move", () => {
    const unsigned = CARDS.filter((c) => c.rarity === "mythic" && !SIGNATURES[c.id]).map((c) => c.id);
    expect(unsigned).toEqual([]);
  });
});
