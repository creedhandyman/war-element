/** Per-card auto-attack defaults, remembered across matches.
 *
 *  Setting a card to FULL used to be a per-instance decision you re-made every
 *  time you summoned it, on a badge stuck to the board token. This is the other
 *  half: mark a card "always" once, in its own card panel, and every copy you
 *  summon from then on arrives already on that mode — in this match and every
 *  match after.
 *
 *  Keyed by DEF id, not instance: the preference belongs to the card, not to the
 *  particular body standing on the board. Lives in the UI layer and nowhere near
 *  the engine — the engine is pure, replayable and shared with the online peer,
 *  and a value read out of this browser's storage has no business inside it. The
 *  preference reaches the engine the only honest way: as a field on the SUMMON
 *  intent, so a replay of that intent produces the same result on any machine.
 */
import type { AutoMode } from "../engine";

const KEY = "we_auto_defaults";

type Prefs = Record<string, AutoMode>;

/** Read the whole map. Storage can be unavailable (private mode, disabled) or
 *  hold something a previous version wrote, so a bad read degrades to "no
 *  preferences" rather than taking the app down on load. */
export function loadAutoPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Prefs = {};
    for (const [id, mode] of Object.entries(parsed as Record<string, unknown>))
      if (mode === "manual" || mode === "basic" || mode === "full") out[id] = mode;
    return out;
  } catch {
    return {};
  }
}

/** The remembered mode for a card, or undefined if it has none. */
export function autoPrefFor(defId: string): AutoMode | undefined {
  return loadAutoPrefs()[defId];
}

/** Remember a mode for every future copy of this card, or forget it when
 *  `mode` is undefined. Forgetting REMOVES the key rather than writing a
 *  "manual" default, so "no preference" and "deliberately manual" stay
 *  distinguishable — the first follows any future change to the game's default,
 *  the second does not. */
export function setAutoPref(defId: string, mode: AutoMode | undefined): void {
  try {
    const prefs = loadAutoPrefs();
    if (mode === undefined) delete prefs[defId];
    else prefs[defId] = mode;
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — the session still works, it just won't be remembered */
  }
}
