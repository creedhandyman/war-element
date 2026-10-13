/** TAP OR CLICK? Words for the thing the player's finger or mouse does.
 *
 *  The hints were written at a desk: "click a glowing Home slot". Most players
 *  hold a phone, where nothing is clicked, and a word that is slightly wrong
 *  makes the whole line read as "this was not written for me". Shop's pack
 *  reveal already asked the media query; this is the same question asked once,
 *  for every line of instruction that mentions it. */

/** A touch screen is the primary pointer. A laptop with a touch panel still
 *  answers `fine` while a mouse is attached, so it keeps "click". */
export function isTouch(): boolean {
  try {
    return typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false);
  } catch {
    return false;
  }
}

const SWAP: Record<string, string> = {
  click: "tap", clicks: "taps", clicked: "tapped", clicking: "tapping",
};

/** Rewrite "click" as "tap" (keeping the capital) when `touch` is true. Hints are
 *  small HTML strings — the tags between the words are left alone. */
export function tapWords(text: string, touch: boolean = isTouch()): string {
  if (!touch) return text;
  return text.replace(/\b(click(?:s|ed|ing)?)\b/gi, (w) => {
    const to = SWAP[w.toLowerCase()];
    return w[0] === w[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
  });
}

/** The verb for JSX copy that is not a string to rewrite: `{tap}` / `{Tap}`. */
export function tapVerb(touch: boolean = isTouch()): { tap: string; Tap: string } {
  return touch ? { tap: "tap", Tap: "Tap" } : { tap: "click", Tap: "Click" };
}
