// The roster document is generated, and a generated document nobody regenerates
// is worse than no document — it reads as authoritative while being wrong. This
// fails the moment the committed file drifts from the card data.
//
// The document is read through Vite's `?raw` rather than node:fs on purpose: this
// project has no @types/node, and adding it to get `fs` here would pull Node's
// globals into a browser codebase — `setTimeout` would start returning
// NodeJS.Timeout instead of number, across a React app full of timers. A missing
// file fails loudly at transform time, which also covers "is it committed".

import { describe, expect, it } from "vitest";
import ROSTER_DOC from "../../../docs/ROSTER.md?raw";
import { CARDS, TOKENS } from "../../data/cards";
import { SPELLS } from "../spells";
import { buildRoster } from "../../tools/roster";

describe("the roster document", () => {
  it("matches the card data exactly — regenerate with `npm run roster`", () => {
    // Compared whole rather than by spot-check: the point is that EVERY edit to a
    // card, a special or a spell reaches the document, and a looser assertion
    // would let ability text drift while the ids still lined up.
    expect(ROSTER_DOC).toBe(buildRoster());
  });

  it("names every card, token and spell", () => {
    // A cheap check on the generator itself. If buildRoster ever silently dropped
    // a group (an element typo, a filter that stops matching), the whole-file
    // comparison above would still pass — both sides would be wrong together.
    // This one knows what the answer should be.
    const missing: string[] = [];
    for (const c of [...CARDS, ...TOKENS]) if (!ROSTER_DOC.includes(`\`${c.id}\``)) missing.push(c.id);
    for (const s of SPELLS) if (!ROSTER_DOC.includes(`\`${s.id}\``)) missing.push(s.id);
    expect(missing).toEqual([]);
  });

  it("gives every entry its abilities and a lore slot, not just stats", () => {
    // Guards the reason the document exists: a roster without abilities is a
    // stat table, and one without lore slots is not a lore working document.
    const entries = ROSTER_DOC.split(/^#### /m).slice(1);
    expect(entries.length).toBe(CARDS.length + TOKENS.length + SPELLS.length);
    const named = (e: string) => e.split(" ")[0];
    // Spells carry Text rather than Passives; cards and tokens must have both.
    const cardEntries = entries.filter((e) => e.includes("**Stats**"));
    expect(cardEntries.length).toBe(CARDS.length + TOKENS.length);
    expect(cardEntries.filter((e) => !e.includes("**Passives**")).map(named)).toEqual([]);
    expect(entries.filter((e) => !e.includes("**Lore**")).map(named)).toEqual([]);
  });
});
