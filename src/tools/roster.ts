/** The roster document: every card, every ability, every spell, in one place.
 *
 *  GENERATED, deliberately. A hand-written roster of 341 cards is a lie within a
 *  week of the next balance pass — and this repo does a balance pass most days.
 *  `roster.test.ts` fails if the committed file drifts from the data, so the doc
 *  cannot rot silently; run `npm run roster` to regenerate it.
 *
 *  Ability text is NOT re-derived here. It comes from `describePassives`, the
 *  same function the in-game card inspector uses, so the roster and the game can
 *  never disagree about what a card does. (That function lives in the UI layer,
 *  which is why this is a tool rather than something under src/data — a data
 *  module importing from src/ui would invert the layering. Somewhere neutral
 *  would be a tidier home for it.)
 *
 *  Purpose: the working document for the lore pass. Every entry ends with its Lore
 *  line, taken from `def.lore` — prose authored in data/lore/<element>.ts and
 *  attached to the defs at load. Entries not yet written read "(none yet)", and the
 *  header and contents carry the running coverage counts, so this doubles as the
 *  tracker for how far the pass has got.
 */
import { CARDS, TOKENS } from "../data/cards";
import { sourcesOf } from "../data/story";
import { ELEMENT_AURA } from "../engine/auras";
import { SPELLS } from "../engine/spells";
import type { CardDef, Element, SpellDef } from "../engine/types";
import { describePassives } from "../ui/CardDetail";

/** Where the generated document lives. One constant, so the writer, the
 *  staleness test and the docs all point at the same file. */
export const ROSTER_PATH = "docs/ROSTER.md";

/** Play order, matching the deck builder's element row. */
const ELEMENTS: Element[] = ["LEAF", "PYRO", "AQUA", "DAWN", "GALE", "BOLT", "DUSK", "BORE"];

/** Marquee characters first: a Mythic is the one whose lore sets the tone for the
 *  element, so it should not be buried under twenty Rares. */
const RARITY_ORDER = ["mythic", "legendary", "epic", "rare"] as const;
const rarityRank = (r?: string) => {
  const i = RARITY_ORDER.indexOf((r ?? "rare") as (typeof RARITY_ORDER)[number]);
  return i === -1 ? RARITY_ORDER.length : i;
};

function byRarityThenCost(a: CardDef, b: CardDef): number {
  return rarityRank(a.rarity) - rarityRank(b.rarity) || a.cost - b.cost || a.name.localeCompare(b.name);
}

/** Every tribe on the card. `tribe` is `string | string[]` — most carry one, a
 *  few (Totem: Avian + Wolf) carry several — so it is normalised, not assumed. */
function tribesOf(def: CardDef): string[] {
  if (def.tribe == null) return [];
  return Array.isArray(def.tribe) ? def.tribe : [def.tribe];
}

/** "DMG 4 ×2 · HP 12 · Shields 1 · SP 8" — the hits multiplier only when it is
 *  more than one, so single-hit cards do not all carry a noisy "×1". */
function statLine(def: CardDef): string {
  const dmg = def.hits > 1 ? `DMG ${def.dmg} ×${def.hits}` : `DMG ${def.dmg}`;
  return [dmg, `HP ${def.hp}`, `Shields ${def.shields}`, `SP ${def.sp}`].join(" · ");
}

/** The stat budget this repo balances against: total should sit within ±2 of
 *  `5 * cost + 10`. Printed so a lore pass doubles as a balance read-through —
 *  the deliberate exceptions are listed in state.test.ts, not here. */
function budgetLine(def: CardDef): string {
  const total = def.dmg * def.hits + def.hp + def.shields * 2 + def.sp;
  const target = 5 * def.cost + 10;
  const delta = total - target;
  return `Budget ${total} vs ${target} (${delta === 0 ? "on" : delta > 0 ? `+${delta}` : `${delta}`})`;
}

/** "1 token" / "2 tokens" / "0 tokens" — PYRO and BORE field no tokens at all. */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function keywordLine(def: CardDef): string | null {
  const on = Object.entries(def.keywords)
    .filter(([, v]) => v)
    .map(([k, v]) => (typeof v === "number" && v !== 1 ? `${k} ${v}` : k));
  return on.length ? on.join(", ") : null;
}

/** Where the campaign lets you meet this card. Lore that contradicts the region a
 *  card is farmed in is the main way a document like this drifts from the map. */
function foundAt(def: CardDef): string | null {
  const sources = sourcesOf(def.id);
  if (!sources.length) return null;
  return sources
    .map((s) => `${s.region.name.split(" — ")[0]} · ${s.node.name}${s.overflow ? " (overflow)" : ""}`)
    .join("; ");
}

/** Which cards summon this token, so a token's lore can answer to its summoner. */
function spawnedBy(tokenId: string): string | null {
  const parents = CARDS.filter(
    (c) => c.summonSpawn?.token === tokenId || c.special?.params?.token === tokenId,
  ).map((c) => c.name);
  return parents.length ? [...new Set(parents)].join(", ") : null;
}

function cardEntry(def: CardDef, opts: { token?: boolean } = {}): string[] {
  const out: string[] = [];
  out.push(`#### ${def.name} · \`${def.id}\``);
  out.push("");
  const rarity = (def.rarity ?? "rare").replace(/^./, (c) => c.toUpperCase());
  out.push(`${rarity} · ${def.cardClass} · ${def.attackType} · Cost ${def.cost}`);
  out.push("");
  out.push(`- **Stats** — ${statLine(def)} · ${budgetLine(def)}`);
  const tribes = tribesOf(def);
  if (tribes.length) out.push(`- **Tribe** — ${tribes.join(", ")}`);
  const kw = keywordLine(def);
  if (kw) out.push(`- **Keywords** — ${kw}`);
  if (def.special) {
    out.push(`- **Special · ${def.special.name}** (${def.special.cost}◆) — ${def.special.text}`);
  } else {
    out.push(`- **Special** — none`);
  }
  // describePassives opens with the card's own element aura, which is identical
  // for all 39 cards in an element — 312 repetitions of a four-line paragraph,
  // drowning the thing each entry is actually for. It is stated once at the top of
  // each element section instead. BORROWED auras stay: SirCrest carrying PYRO and
  // AQUA is a fact about SirCrest.
  const passives = describePassives(def).filter((p) => !p.startsWith(`${def.element} aura — `));
  if (passives.length) {
    out.push(`- **Passives**`);
    for (const p of passives) out.push(`  - ${p}`);
  } else {
    out.push(`- **Passives** — none beyond the ${def.element} aura`);
  }
  if (opts.token) {
    out.push(`- **Summoned by** — ${spawnedBy(def.id) ?? "nothing (orphan token)"}`);
  } else {
    out.push(`- **Found at** — ${foundAt(def) ?? "not placed in the campaign"}`);
  }
  // Printed whether or not it is written, so the slots still to fill stay visible.
  out.push(`- **Lore** — ${def.lore ?? "_(none yet)_"}`);
  out.push("");
  return out;
}

const SPELL_KIND_LABEL: Record<string, string> = {
  damage: "Damage", aoe: "Area", buff: "Buff", heal: "Heal", field: "Field",
  wall: "Wall", trap: "Trap", convert: "Convert", summon: "Summon",
  control: "Control", choice: "Choice",
};

function spellEntry(sp: SpellDef): string[] {
  const bits = [SPELL_KIND_LABEL[sp.kind] ?? sp.kind, `Cost ${sp.cost}✦`];
  if (sp.field?.rounds) bits.push(`${sp.field.rounds} rounds`);
  if (sp.area) bits.push(`area: ${sp.area}`);
  return [
    `#### ${sp.name} · \`${sp.id}\``,
    "",
    bits.join(" · "),
    "",
    `- **Text** — ${sp.text}`,
    `- **Lore** — ${sp.lore ?? "_(none yet)_"}`,
    "",
  ];
}

export function buildRoster(): string {
  const L: string[] = [];
  const cardsByEl = (el: Element) => CARDS.filter((c) => c.element === el).sort(byRarityThenCost);
  const tokensByEl = (el: Element) => TOKENS.filter((c) => c.element === el).sort(byRarityThenCost);
  const spellsByEl = (el: Element) => SPELLS.filter((s) => s.element === el).sort((a, b) => a.cost - b.cost);

  L.push("# War Element — Card & Spell Roster");
  L.push("");
  L.push(
    "Every card, every ability, every spell. **Generated — do not hand-edit:** run " +
      "`npm run roster` after any change to `src/data/cards.ts` or `src/engine/spells.ts`. " +
      "`roster.test.ts` fails if this file drifts from the data.",
  );
  L.push("");
  L.push(
    "Ability text comes from `describePassives`, the same function the in-game card " +
      "inspector uses, so this document and the game cannot disagree about what a card does.",
  );
  L.push("");
  const loreDone = [...CARDS, ...TOKENS].filter((c) => c.lore).length + SPELLS.filter((s) => s.lore).length;
  const loreTotal = CARDS.length + TOKENS.length + SPELLS.length;
  L.push(
    `**Lore** — ${loreDone} of ${loreTotal} written. Prose lives in \`src/data/lore/<element>.ts\`, ` +
      "keyed by id; anything still to write reads _(none yet)_ below, so this document doubles " +
      "as the progress tracker for the lore pass.",
  );
  L.push("");
  L.push(
    `**Totals** — ${CARDS.length} draftable cards · ${TOKENS.length} tokens · ` +
      `${SPELLS.length} spells · ${ELEMENTS.length} elements.`,
  );
  L.push("");
  L.push("## Contents");
  L.push("");
  for (const el of ELEMENTS) {
    const entries = [...cardsByEl(el), ...tokensByEl(el), ...spellsByEl(el)];
    const done = entries.filter((e) => e.lore).length;
    L.push(
      `- [${el}](#${el.toLowerCase()}) — ${plural(cardsByEl(el).length, "card")}, ` +
        `${plural(tokensByEl(el).length, "token")}, ${plural(spellsByEl(el).length, "spell")}` +
        ` · lore ${done}/${entries.length}${done === entries.length ? " ✓" : ""}`,
    );
  }
  L.push("");

  for (const el of ELEMENTS) {
    const aura = ELEMENT_AURA[el];
    const cards = cardsByEl(el);
    const tokens = tokensByEl(el);
    const spells = spellsByEl(el);
    L.push(`---`);
    L.push("");
    L.push(`## ${el}`);
    L.push("");
    // The element aura is on every card in the element, so state it once here
    // rather than making the reader notice it repeated forty times below.
    L.push(`**Element aura · ${aura.name}** — ${aura.desc}`);
    L.push("");
    L.push(`${plural(cards.length, "card")} · ${plural(tokens.length, "token")} · ${plural(spells.length, "spell")}`);
    L.push("");
    L.push(`### ${el} — cards`);
    L.push("");
    let rarity = "";
    for (const def of cards) {
      const r = def.rarity ?? "rare";
      if (r !== rarity) {
        rarity = r;
        L.push(`<!-- ${r} -->`);
        L.push("");
      }
      L.push(...cardEntry(def));
    }
    if (tokens.length) {
      L.push(`### ${el} — tokens`);
      L.push("");
      L.push(
        "Not draftable: these arrive on the board from another card's ability, so their " +
          "lore answers to whatever summons them.",
      );
      L.push("");
      for (const def of tokens) L.push(...cardEntry(def, { token: true }));
    }
    if (spells.length) {
      L.push(`### ${el} — spells`);
      L.push("");
      for (const sp of spells) L.push(...spellEntry(sp));
    }
  }

  // Anything whose element is outside the eight — nothing today, but a silent
  // omission is exactly the failure a generated census should not have.
  const covered = new Set<string>(ELEMENTS);
  const orphans = [...CARDS, ...TOKENS].filter((c) => !covered.has(c.element));
  const orphanSpells = SPELLS.filter((s) => !covered.has(s.element));
  if (orphans.length || orphanSpells.length) {
    L.push(`---`);
    L.push("");
    L.push(`## Unfiled`);
    L.push("");
    L.push("These carry an element outside the eight above — almost certainly a typo.");
    L.push("");
    for (const def of orphans) L.push(...cardEntry(def));
    for (const sp of orphanSpells) L.push(...spellEntry(sp));
  }

  return L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
