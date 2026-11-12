import { useEffect, useRef, useState } from "react";
import { getDef } from "../engine";
import { CARDS, TOKENS } from "../data/cards";
import { EL_COLOR, RARITY_STYLE } from "./shared";
import { BattleFace } from "./BattleFace";

/** Rarities that get an entrance. Anything below legendary lands quietly —
 *  announcing every summon would turn the fanfare into noise. */
export const ANNOUNCE_RARITIES = new Set(["legendary", "mythic"]);

/** Every id that some card wears as a face. Built once from the data rather
 *  than listed, so a second disguised card inherits this for free. */
const DISGUISE_FACES = new Set(
  [...CARDS, ...TOKENS]
    .map((d) => d.disguise?.as)
    .filter((id): id is string => !!id),
);

/** Should summoning this card be announced?
 *
 *  A disguise is silent in BOTH directions, which is the whole point of it:
 *  announcing the true form names a card that is not what lands, and announcing
 *  the face gives a full-screen legendary entrance to something that is meant to
 *  look like furniture. Nightfang arrives as the Butler; nobody should be able
 *  to tell from the fanfare. */
export function announces(defId: string): boolean {
  const def = getDef(defId);
  if (def.disguise || DISGUISE_FACES.has(defId)) return false;
  return def.rarity != null && ANNOUNCE_RARITIES.has(def.rarity);
}

/** How long the card is held up before it starts down, of the 2s the
 *  announcement runs for (ANNOUNCE_MS in App). The rest is the descent — long
 *  enough to read as being lowered rather than thrown. */
const HOLD_MS = 1120;
const DROP_MS = 760;

export interface Box { left: number; top: number; width: number; height: number }

/** The flight: card centre to square centre, shrunk to the square.
 *
 *  Pure and exported because it is the whole of the behaviour and the component
 *  around it cannot be rendered in this repo's test setup. The SMALLER of the
 *  two ratios, so the card lands INSIDE the square: a card is taller than it is
 *  wide and a square is square, so scaling by width would hang its chin over
 *  the slot below. Degenerate rectangles (a board that has not laid out, a
 *  measurement taken mid-unmount) have no flight — the card simply fades,
 *  which is what the entrance always did. */
export function dropOnto(card: Box, slot: Box): { dx: number; dy: number; k: number } | null {
  if (card.width <= 0 || card.height <= 0 || slot.width <= 0 || slot.height <= 0) return null;
  return {
    dx: (slot.left + slot.width / 2) - (card.left + card.width / 2),
    dy: (slot.top + slot.height / 2) - (card.top + card.height / 2),
    k: Math.min(slot.width / card.width, slot.height / card.height),
  };
}

/** Full-screen announcement for a powerful creature arriving. Mirrors
 *  SpellCastFlash: App holds the SUMMON intent, mounts this for ~2s so the card
 *  gets its moment, then dispatches so it actually lands. The opponent's
 *  legendaries are detected on arrival instead (their summons resolve outside
 *  our dispatch), so for those it reads as an entrance rather than a preview.
 *
 *  IT IS THE BATTLE CARD (owner, 2026-10-22), not a poster of it. The art used
 *  to be shown square with its own name/stat layout below — a thing the player
 *  saw nowhere else in the game, for two seconds, about a card they were about
 *  to be holding. `BattleFace` is the face it wears in the hand and the one it
 *  keeps here, so the entrance shows the card arriving rather than an
 *  advertisement for it.
 *
 *  ...AND IT IS LOWERED ONTO THE FIELD. The card travels from the middle of the
 *  screen down into the square it is landing on, shrinking to the size of it,
 *  and hands over to the real card there. Without that the announcement ended
 *  by fading out over the board, which said nothing about where the thing had
 *  gone; the flight is the sentence "this one, here".
 *
 *  `at` is the LOGICAL square (`data-pos`, so it is right on a flipped P2
 *  board). Measured from the DOM for the same reason the action ring is: the
 *  board's geometry is a chain of CSS variables and recomputing it here would
 *  be a second source of truth for the same pixels. No square (or no board, or
 *  reduced motion) → it simply fades, which is what it always did. */
export function SummonAnnounce({ defId, mine, at }: {
  defId: string;
  mine: boolean;
  /** The square it is landing on, for the descent. */
  at?: { row: number; col: number } | null;
}) {
  const def = getDef(defId);
  const rar = def.rarity ? RARITY_STYLE[def.rarity] : null;
  const cardRef = useRef<HTMLDivElement | null>(null);
  /** The transform that puts this card over its square, set once the hold is
   *  up. Null until then — and for good, when there is nowhere to go. */
  const [drop, setDrop] = useState<{ dx: number; dy: number; k: number } | null>(null);
  useEffect(() => {
    if (!at) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setTimeout(() => {
      const card = cardRef.current;
      const slot = document.querySelector<HTMLElement>(`[data-pos="${at.row},${at.col}"]`);
      if (!card || !slot) return;
      setDrop(dropOnto(card.getBoundingClientRect(), slot.getBoundingClientRect()));
    }, HOLD_MS);
    return () => window.clearTimeout(t);
  }, [at]);
  return (
    <div
      className={`announce${drop ? " dropping" : ""}`}
      data-el={def.element}
      style={{ ["--rar" as string]: rar?.color ?? EL_COLOR[def.element] }}
    >
      <div className="announce-burst" />
      {/* Badge sits ABOVE the card rather than on the art. It has to live
          outside the card to do that at all — the card clips its children, so
          no amount of offset would lift it clear. The entrance animation is on
          .announce-stack so the two still scale in as one piece; the DESCENT is
          on the card alone, because the badge stays behind. */}
      <div className="announce-stack">
        <div className="announce-rar">{rar?.label ?? "POWERFUL"}</div>
        <div
          ref={cardRef}
          className="announce-card hcard carded"
          data-el={def.element}
          style={drop ? {
            ["--dx" as string]: `${drop.dx}px`,
            ["--dy" as string]: `${drop.dy}px`,
            ["--k" as string]: `${drop.k}`,
            ["--drop-ms" as string]: `${DROP_MS}ms`,
          } : undefined}
        >
          <BattleFace def={def} />
        </div>
      </div>
      <div className="announce-who">{mine ? "You summon" : "Your opponent summons"}</div>
    </div>
  );
}
