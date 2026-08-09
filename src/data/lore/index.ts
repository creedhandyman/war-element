/** Flavour text for cards, tokens and spells, keyed by id.
 *
 *  One file per element, added here as each element's pass lands. The merged map
 *  is attached onto CardDef.lore / SpellDef.lore at load — see the attach step at
 *  the foot of data/cards.ts and engine/spells.ts — so every reader (the card
 *  inspector, the generated roster) just asks `def.lore` and needs no second
 *  lookup.
 *
 *  Lore is deliberately NOT inline in cards.ts. It is prose rather than
 *  mechanics, it is written an element at a time, and cards.ts is already nine
 *  thousand lines; keeping them apart means a lore pass produces a diff a person
 *  can actually read.
 */
import { LEAF_LORE } from "./leaf";
import { PYRO_LORE } from "./pyro";
import { GALE_LORE } from "./gale";

/** Every element's map, kept as a list so `lore.test.ts` can spot the same id
 *  being claimed by two elements — a plain spread would silently let the last one
 *  win, and the losing line would vanish with nothing to show it ever existed. */
export const LORE_SOURCES: Record<string, string>[] = [LEAF_LORE, PYRO_LORE, GALE_LORE];

export const LORE: Record<string, string> = Object.assign({}, ...LORE_SOURCES);

/** Lore for one CARD id, or undefined. Prefer `def.lore`; this is for the rare
 *  caller holding an id but no def. */
export function loreFor(id: string): string | undefined {
  return LORE[id];
}

/** Two ids in the data are BOTH a card and a spell — `bolt_zap` and
 *  `gale_tempest`, each a card and a spell of the same name. The game gets away
 *  with it because cards and spells are looked up through different tables, but a
 *  single map keyed by id cannot hold two different lines for one key: the card's
 *  prose would silently appear on the spell.
 *
 *  So a spell may be keyed `spell:<id>` to claim its own line, falling back to the
 *  plain id for the seventy-eight spells whose ids collide with nothing. A test
 *  requires the prefixed form for the colliding ids, so this cannot regress into
 *  a card's flavour quietly leaking onto a spell. */
export const SPELL_LORE_PREFIX = "spell:";

export function loreForSpell(id: string): string | undefined {
  return LORE[SPELL_LORE_PREFIX + id] ?? LORE[id];
}
