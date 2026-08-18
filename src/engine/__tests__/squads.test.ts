// The squad library replaced two near-identical stores. The tests that matter
// are the migration ones: somebody has lineups saved in BOTH of the old
// libraries, and losing one because storage got tidier is not acceptable.

import { beforeEach, describe, expect, it } from "vitest";
import {
  absorbLegacy, deleteSquad, loadSquads, missingNames, saveSquad, squadUsableIn,
} from "../../data/squads";

// jsdom is not on in this project, so stand up the smallest localStorage that
// behaves like the real one for these calls.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const deck = (name: string, cards: string[], spells?: string[]) => ({ id: `d_${name}`, name, cards, spells });
const team = (name: string, cards: string[], element?: string) => ({ id: `t_${name}`, name, cards, element });

beforeEach(() => store.clear());

describe("squads — saving", () => {
  it("round trips through storage", () => {
    saveSquad({ name: "Frost", cards: ["aqua_subcool", "aqua_misty"], boardSize: 4 });
    const [got] = loadSquads();
    expect(got.name).toBe("Frost");
    expect(got.cards).toEqual(["aqua_subcool", "aqua_misty"]);
    expect(got.boardSize).toBe(4);
  });

  it("replaces by name instead of piling up near-duplicates", () => {
    // Re-tuning a squad after a loss should not leave four called "Anti-PYRO".
    saveSquad({ name: "Anti-PYRO", cards: ["aqua_subcool"] });
    saveSquad({ name: "anti-pyro", cards: ["aqua_misty", "aqua_arctik"] });
    const list = loadSquads();
    expect(list).toHaveLength(1);
    expect(list[0].cards).toHaveLength(2);
  });

  it("drops cards the build no longer has", () => {
    saveSquad({ name: "Stale", cards: ["aqua_subcool", "card_that_was_deleted"] });
    expect(loadSquads()[0].cards).toEqual(["aqua_subcool"]);
  });

  it("deletes", () => {
    const [a] = saveSquad({ name: "Gone", cards: ["aqua_subcool"] });
    expect(deleteSquad(a.id)).toEqual([]);
    expect(loadSquads()).toEqual([]);
  });
});

describe("squads — migrating the two old libraries", () => {
  it("keeps everything from both", () => {
    const out = absorbLegacy(
      [deck("Arena One", ["aqua_subcool"]), deck("Arena Two", ["aqua_misty"])],
      [team("Campaign One", ["leaf_greegon"], "LEAF")],
    )!;
    expect(out.map((s) => s.name).sort()).toEqual(["Arena One", "Arena Two", "Campaign One"]);
    expect(out.find((s) => s.name === "Campaign One")!.element).toBe("LEAF");
  });

  it("collapses the same lineup saved in both, keeping the richer copy", () => {
    // The split made this likely: build it in the Arena, rebuild it for a node.
    // Card ORDER differs between the two saves, which must not defeat the match.
    const out = absorbLegacy(
      [deck("Twin", ["aqua_subcool", "aqua_misty"], ["aqua_chill"])],
      [team("Twin", ["aqua_misty", "aqua_subcool"], "AQUA")],
    )!;
    expect(out).toHaveLength(1);
    expect(out[0].spells).toEqual(["aqua_chill"]); // kept from the Arena copy
    expect(out[0].element).toBe("AQUA");           // and the tag from the campaign one
  });

  it("runs once and never again", () => {
    absorbLegacy([deck("First", ["aqua_subcool"])], []);
    // A second boot must not re-import, or deleting a migrated squad would see it
    // return on the next reload.
    expect(absorbLegacy([deck("Second", ["aqua_misty"])], [])).toBeNull();
    expect(loadSquads().map((s) => s.name)).toEqual(["First"]);
  });

  it("stamps storage even with nothing to import", () => {
    expect(absorbLegacy([], [])).toEqual([]);
    expect(absorbLegacy([deck("Late", ["aqua_subcool"])], [])).toBeNull();
  });

  it("skips empty lineups rather than importing blanks", () => {
    expect(absorbLegacy([deck("Empty", [])], [])).toEqual([]);
  });
});

describe("squads — where one can be used", () => {
  const squad = { id: "s1", name: "Mixed", cards: ["leaf_greegon", "aqua_subcool"] };

  it("is usable in the Arena, where the whole pool is available", () => {
    expect(squadUsableIn(squad).ok).toBe(true);
  });

  it("names what the collection is missing, rather than just refusing", () => {
    const r = squadUsableIn(squad, { owned: ["leaf_greegon"] });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["aqua_subcool"]);
    expect(r.reason).toContain("1 card");
    expect(missingNames(r.missing)).toEqual(["SubCool"]);
  });

  it("refuses one that is over the battlefield's cap", () => {
    const big = { id: "s2", name: "Big", cards: Array(30).fill("leaf_greegon") };
    expect(squadUsableIn(big, { cap: 18 }).reason).toContain("the cap is 18");
  });

  it("refuses an empty one", () => {
    expect(squadUsableIn({ id: "s3", name: "None", cards: [] }).ok).toBe(false);
  });
});
