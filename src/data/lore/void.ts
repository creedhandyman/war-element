/**
 * VOID card lore — the ninth element, and the only one with no deck.
 *
 * Keyed by card id, merged onto CardDef.lore at load — see ./index.ts.
 *
 * VOICE RULES — VOID
 *   1. VOID does not want. The other eight all want something; this one only
 *      NOTICES, and being noticed is the harm. Lines are observations, never
 *      threats.
 *   2. It speaks about the reader, not to them. No second person addressed
 *      directly, no boast, no bargain — a thing that is looking does not
 *      announce itself.
 *   3. Nothing is described as dark. Dark is DUSK's word and DUSK uses it to
 *      mean cover. VOID is not hiding anything; it is what is left when there
 *      is nothing to hide behind.
 */
export const VOID_LORE: Record<string, string> = {
  boss_spindle:
    "It is not a spider and there is no web. Those are the words that fit closest, "
    + "which is not the same as fitting. The legs came later, grown to hold the eye "
    + "at a height where nothing is out of sight, and the eye came first, and before "
    + "the eye there is no record of anything at all.",
  void_mote_tok:
    "The smallest piece that can still look. It takes almost nothing from what it "
    + "touches — a single point, once — and it is never once.",
  void_watcher_tok:
    "It does not follow. It arrives where you were going to be, and waits the "
    + "difference out.",
  void_lidless_tok:
    "There was never a lid. The name is a courtesy paid by whoever had to write it "
    + "down, and they wrote it from memory, afterwards.",
  void_scryer_tok:
    "It reads the brood the way the brood reads you, and what it learns travels "
    + "outward faster than anything crosses the ground between them.",
  void_sentinel_tok:
    "Set down at the edge of the light and left there. Everything since has walked "
    + "around it, which was the entire instruction.",
  void_occulith_tok:
    "The eye that grew a body instead of the other way round. Every fourth blow "
    + "comes back — not returned, exactly. Copied.",
};
