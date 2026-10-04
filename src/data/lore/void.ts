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
    "An eye held high on legs. It reaches the whole board, and every third round its gaze mutes, blinds and wears down three targets.",
  void_mote_tok:
    "The smallest eye. It splits itself into another, and every other Watcher alive adds to its damage.",
  void_watcher_tok:
    "A winged eye. It stoops on two targets at once for 7 each, from any slot on the board.",
  void_lidless_tok:
    "There was never a lid. Nothing on the far side is hidden from it, and what it "
    + "looks at stops seeing.",
  void_scryer_tok:
    "It sees what is coming and tells the rest. Foresight shields an ally and its neighbours for 4 and adds damage, and every Watcher hits harder for it.",
  void_sentinel_tok:
    "A watchpost that does not move. Nothing can target the square behind it until it falls, and Bulwark plates an ally and its neighbours for 5.",
  void_occulith_tok:
    "The eye that grew a body. Reap sweeps the whole row ahead for 9, straight through shields.",
};
