// The squad library replaced two near-identical stores. The tests that matter
// are the migration ones: somebody has lineups saved in BOTH of the old
// libraries, and losing one because storage got tidier is not acceptable.

import { beforeEach, describe, expect, it } from "vitest";
import {
  absorbLegacy, deleteSquad, loadSquads, missingNames, packFromSquad, preferredSquad, saveSquad, squadNamed,
  squadUsableIn, squadsFor, type Squad,
} from "../../data/squads";
import { loadStory, rawStoredLoadouts } from "../../data/story";

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

describe("squads — migration reads the raw store, not the playable view", () => {
  it("keeps a campaign team naming cards the collection no longer holds", () => {
    // The bug this pins. `loadStory` trims a team's cards to what you currently
    // own — correct for playing, since you cannot field what you have not
    // earned, and destructive for migrating: a team whose cards are all unowned
    // comes back EMPTY and is then dropped. Migrating through it silently
    // deleted the very lineups the merge exists to preserve.
    store.clear();
    store.set("we_story_v1", JSON.stringify({
      collection: [],                        // owns nothing
      loadouts: [{ id: "t1", name: "Kept", cards: ["leaf_greegon"], element: "LEAF" }],
    }));
    const raw = rawStoredLoadouts();
    expect(raw, "the raw store still has it").toHaveLength(1);
    expect(loadStory().loadouts ?? [], "the playable view drops it").toHaveLength(0);

    const out = absorbLegacy([], raw)!;
    expect(out.map((s) => s.name)).toEqual(["Kept"]);
    // And it is correctly reported as unfieldable rather than silently dropped.
    expect(squadUsableIn(out[0], { owned: [] }).ok).toBe(false);
  });
});


describe("squads — which one a screen offers", () => {
  const sq = (id: string, element: string | undefined, n: number): Squad =>
    ({ id, name: id, element, cards: Array.from({ length: n }, () => "leaf_nettle") });

  it("offers back the squad you last used, then the NEWEST match", () => {
    // The bug this guards: prep searched the library FORWARDS for an element
    // match, and squads are appended — so saving a new one and returning to the
    // node silently fought with the oldest. The save was fine; the recall was
    // wrong, which reads from the player's side as "squads not saving".
    const all = [sq("old", "LEAF", 3), sq("new", "LEAF", 5)];
    const anyLegal = () => true;

    // No memory yet -> the NEWEST element match, not the first.
    expect(preferredSquad(all, "LEAF", undefined, anyLegal)?.id).toBe("new");
    // With a memory -> exactly what was last used, even though it is older.
    expect(preferredSquad(all, "LEAF", "old", anyLegal)?.id).toBe("old");
    // A remembered squad that is no longer LEGAL here falls through rather than
    // being offered and then refused.
    expect(preferredSquad(all, "LEAF", "old", (s) => s.cards.length > 4)?.id).toBe("new");
    // A remembered id that no longer exists is simply ignored.
    expect(preferredSquad(all, "LEAF", "deleted", anyLegal)?.id).toBe("new");
    // Nothing for this element -> undefined, and prep keeps the current deck.
    expect(preferredSquad(all, "PYRO", undefined, anyLegal)).toBeUndefined();
  });

  it("floats the matching element without dropping the rest", () => {
    // One library now, so the campaign shelf shows Arena squads too. Sorting is
    // the whole answer to that — hiding them would rebuild the split.
    const all = [sq("arena", undefined, 3), sq("pyro", "PYRO", 3), sq("leaf", "LEAF", 3)];
    expect(squadsFor(all, "PYRO").map((s) => s.id)).toEqual(["pyro", "arena", "leaf"]);
    expect(squadsFor(all, undefined).map((s) => s.id)).toEqual(["arena", "pyro", "leaf"]);
    expect(squadsFor(all, "PYRO"), "does not mutate the input").not.toBe(all);
    expect(all.map((s) => s.id), "input order intact").toEqual(["arena", "pyro", "leaf"]);
  });

  it("hands back the id of the squad just saved, so a caller can point at it", () => {
    // The campaign remembers WHICH squad you took in. `saveSquad` matches by
    // name and mints its own id, so without this the pointer would be a guess.
    const next = saveSquad({ name: "Anti-PYRO", cards: ["leaf_nettle"], element: "LEAF" });
    const saved = squadNamed(next, "Anti-PYRO");
    expect(saved?.id).toBeTruthy();
    expect(loadSquads().find((s) => s.id === saved!.id)?.name).toBe("Anti-PYRO");
    // Re-tuning under the same name overwrites, and the pointer still resolves.
    const again = saveSquad({ name: "  anti-pyro  ", cards: ["leaf_greegon"], element: "LEAF" });
    expect(again).toHaveLength(1);
    expect(squadNamed(again, "Anti-PYRO")?.id, "same squad, same id").toBe(saved!.id);
    expect(squadNamed(again, "nothing named this")).toBeUndefined();
  });
});


// Story mode asks you to choose twice: once in the builder, and again at a
// border deciding which of those cards travel. `packFromSquad` answers the
// second from the first, and the two things it silently drops are the whole
// reason the screen prints a count per squad.
describe("filling a region's pack from a saved squad", () => {
  const dear = "leaf_oakgre";      // cost 10
  const mid = "leaf_greegon";
  const cheap = "leaf_nettle";

  it("takes only what the region will actually let you carry", () => {
    // Packable is the region's pool: what you own, minus the locals that fight
    // free. Anything else in the squad is not being ignored - it cannot travel.
    const squad = [dear, mid, cheap, "aqua_kraken"];
    expect(packFromSquad(squad, [dear, mid, cheap], 10).sort())
      .toEqual([dear, mid, cheap].sort());
    // aqua_kraken is owned by the squad but not in this region's pool.
    expect(packFromSquad(squad, [dear, mid, cheap], 10)).not.toContain("aqua_kraken");
  });

  it("says nothing travels rather than half-filling, when nothing can", () => {
    // A LEAF squad carried into LEAF: every card is local, so the pack is empty
    // and the screen disables that option instead of offering a no-op tap.
    expect(packFromSquad([dear, mid, cheap], [], 10)).toEqual([]);
  });

  it("keeps the DEAREST when the squad outgrows the region's limit", () => {
    // Same instinct as the screen's own "Best": a trimmed pack should lose the
    // filler, not whatever happened to be last in the builder's pick order.
    const got = packFromSquad([cheap, mid, dear], [cheap, mid, dear], 2);
    expect(got).toHaveLength(2);
    expect(got, "the 10-drop survives a trim").toContain(dear);
    expect(got, "the cheapest is what goes").not.toContain(cheap);
  });

  it("never carries the same card twice, and never more than the limit", () => {
    expect(packFromSquad([mid, mid, mid], [mid], 5)).toEqual([mid]);
    expect(packFromSquad([dear, mid, cheap], [dear, mid, cheap], 0)).toEqual([]);
  });
});
