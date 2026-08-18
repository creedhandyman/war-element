/** Squads — one saved lineup, used everywhere.
 *
 *  ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *  There used to be two of these. The Arena had `CustomDeck {id, name, cards,
 *  spells}` in localStorage; the campaign had `Loadout {id, name, cards, spells,
 *  element}` inside the story save. They differ by one optional tag, and they
 *  were saved by different functions, listed by different panels, and called by
 *  different names ("deck" / "team") — so one builder had to be two builders,
 *  branching on which mode it was in nearly fifty times, and a lineup built in
 *  the Arena could not be taken into the campaign at all. You built the same
 *  thing twice.
 *
 *  A squad is a squad. Where you can USE it is a question about your collection
 *  and the battlefield, not about which screen saved it — so that question is
 *  answered by `squadUsableIn`, at the point of use, instead of by keeping two
 *  libraries.
 */
import { CARD_INDEX, getDef } from "./cards";
import { isBuildable, sanitizeSpells } from "./custom-decks";

export interface Squad {
  id: string;
  name: string;
  cards: string[];
  /** Hand-picked spellbook. Absent = derive one from the squad's elements. */
  spells?: string[];
  /** Element this squad answers, carried over from a campaign team. Cosmetic —
   *  it sorts the campaign's quick-select, and nothing enforces it. */
  element?: string;
  /** Battlefield it was built for (4 or 5), so the builder opens at the right
   *  size and the deck code can carry it. */
  boardSize?: number;
}

const STORAGE_KEY = "we_squads_v1";

/** Same lineup by any other name: identical cards, order ignored. Used to
 *  collapse the duplicates the two-library era inevitably produced — the same
 *  deck saved once in each place. */
function sameCards(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((id, i) => id === y[i]);
}

/** Drop anything the build no longer has, so a renamed or retired card cannot
 *  wedge a squad. Mirrors what loadCustomDecks always did. */
function clean(s: Squad): Squad {
  return {
    ...s,
    cards: s.cards.filter((id) => CARD_INDEX[id] && isBuildable(id)),
    spells: sanitizeSpells(s.spells, s.boardSize ?? 5),
  };
}

export function loadSquads(): Squad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { squads?: Squad[] };
    const list = Array.isArray(parsed?.squads) ? parsed.squads : [];
    return list
      .filter((s) => s && typeof s.id === "string" && typeof s.name === "string" && Array.isArray(s.cards))
      .map(clean);
  } catch {
    return [];
  }
}

export function persistSquads(squads: Squad[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, squads }));
  } catch {
    /* storage full or blocked — the in-memory list still works this session */
  }
}

/** Save or update. Matching by NAME is deliberate: re-tuning "Anti-PYRO" after a
 *  loss should replace it, not leave you scrolling past four of them. Pass an id
 *  to rename an existing squad instead. */
export function saveSquad(input: Omit<Squad, "id"> & { id?: string }): Squad[] {
  const list = loadSquads();
  const name = input.name.trim() || "Untitled squad";
  const existing = input.id
    ? list.find((s) => s.id === input.id)
    : list.find((s) => s.name.toLowerCase() === name.toLowerCase());
  const entry: Squad = clean({
    id: existing?.id ?? `sq_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    cards: [...input.cards],
    spells: input.spells,
    element: input.element,
    boardSize: input.boardSize,
  });
  const next = existing ? list.map((s) => (s.id === entry.id ? entry : s)) : [...list, entry];
  persistSquads(next);
  return next;
}

export function deleteSquad(id: string): Squad[] {
  const next = loadSquads().filter((s) => s.id !== id);
  persistSquads(next);
  return next;
}

/** Can this squad be fielded right now?
 *
 *  The question the two-library split was really encoding. A campaign fight can
 *  only use cards you have earned, and a battlefield has a size — so instead of
 *  keeping campaign squads in their own store, ask here, at the point of use.
 *
 *  `owned` absent means no collection limit (the Arena), where every card is
 *  available and only the size matters.
 */
export function squadUsableIn(
  squad: Squad,
  opts: { owned?: readonly string[]; cap?: number } = {},
): { ok: boolean; missing: string[]; reason?: string } {
  const owned = opts.owned ? new Set(opts.owned) : null;
  const missing = owned ? squad.cards.filter((id) => !owned.has(id)) : [];
  if (missing.length)
    return {
      ok: false,
      missing,
      reason: `${missing.length} card${missing.length === 1 ? "" : "s"} not in your collection`,
    };
  if (squad.cards.length === 0) return { ok: false, missing, reason: "Empty squad" };
  if (opts.cap != null && squad.cards.length > opts.cap)
    return { ok: false, missing, reason: `${squad.cards.length} cards — the cap is ${opts.cap}` };
  return { ok: true, missing };
}

/** Readable names for the cards a squad is missing, for the greyed-out tooltip. */
export function missingNames(missing: readonly string[]): string[] {
  return missing.map((id) => (CARD_INDEX[id] ? getDef(id).name : id));
}

/** Fold the two old libraries into this one, once.
 *
 *  Called on boot with whatever the legacy stores hold. Everything survives —
 *  losing a lineup somebody built is not an acceptable cost for tidier storage —
 *  and identical duplicates (the same deck saved once in each library, which the
 *  split made likely) collapse into one.
 *
 *  Returns null when there is nothing to do, so the caller can skip the write.
 */
export function absorbLegacy(
  legacyDecks: readonly { id: string; name: string; cards: string[]; spells?: string[] }[],
  legacyTeams: readonly { id: string; name: string; cards: string[]; spells?: string[]; element?: string }[],
): Squad[] | null {
  if (localStorage.getItem(STORAGE_KEY)) return null; // already migrated
  if (!legacyDecks.length && !legacyTeams.length) {
    persistSquads([]); // stamp it so this never runs again
    return [];
  }
  const out: Squad[] = [];
  const add = (s: Omit<Squad, "id"> & { id: string }) => {
    if (!s.cards.length) return;
    const twin = out.find((e) => e.name.toLowerCase() === s.name.toLowerCase() && sameCards(e.cards, s.cards));
    if (twin) {
      // Same lineup under the same name in both libraries. Keep the one that
      // carries more: a spellbook or an element tag is information, not noise.
      twin.spells = twin.spells?.length ? twin.spells : s.spells;
      twin.element = twin.element ?? s.element;
      return;
    }
    out.push(clean({ ...s }));
  };
  for (const d of legacyDecks) add({ ...d, id: d.id });
  for (const t of legacyTeams) add({ ...t, id: t.id });
  persistSquads(out);
  return out;
}
