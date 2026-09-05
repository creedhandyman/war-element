/** The battle verbs, orbiting the card they belong to.
 *
 *  HUD 1b from the redesign, applied where it earns its keep: the moment your
 *  card comes up in the queue and you have to choose what it does. The verbs
 *  used to be a 2x2 grid of buttons in the bottom bar, ~98px of a phone screen,
 *  and on a 5x5 board the fourth one (Skip) rendered below the bottom of the
 *  viewport — which is a STUCK state, because Skip is how you pass a turn you
 *  cannot act on.
 *
 *  Putting them on the board fixes that by not needing the space at all, and it
 *  is better anyway: the choice is about a specific card, and now it happens at
 *  that card instead of 500px away at the bottom of the screen. Your eyes are
 *  already there — the queue just highlighted it.
 *
 *  WHAT THIS DOES NOT OWN. Every verb's behaviour, disabled state, label and
 *  two-press arming stays in App.tsx and arrives through `verbs`. This file
 *  places them on a circle and nothing else. That matters because the same
 *  array also renders the desktop button row: one source, so the two can never
 *  disagree about whether Special is affordable.
 */
import type { ReactNode } from "react";

export interface WheelVerb {
  key: string;
  /** Short label for the ring — the bar's label can be longer. */
  short: string;
  /** Ring colour. Border and text; the fill is a wash of the same. */
  tone: string;
  disabled?: boolean;
  /** Armed for its confirming second press. */
  armed?: boolean;
  title?: string;
  onClick: () => void;
}

/** Compass points, in the order verbs are handed over. Four is the maximum a
 *  ring this size can hold without the chips touching, and four is also the
 *  most the game ever offers: attack, special, talent, skip. */
const SEATS = ["top", "right", "bottom", "left"] as const;
export type WheelSeat = (typeof SEATS)[number];

/** A verb with its compass point decided. */
export interface SeatedVerb extends WheelVerb {
  seat: WheelSeat;
}

/** THE RING GETS OUT OF THE WAY ONCE YOU HAVE CHOSEN.
 *
 *  Four chips and a scrim sit ON TOP of the four slots around the acting card —
 *  which is exactly where its targets are. That is the right trade while you are
 *  picking a VERB, and the wrong one the moment you have picked one and are
 *  trying to tap the card next to you: the control is now standing on the thing
 *  it is asking you to choose.
 *
 *  So an armed wheel collapses to two chips and no scrim. The verb you chose
 *  stays in its own seat, still labelled with what a second press does (FIRE 2 /
 *  AUTO / CONFIRM), and CANCEL takes the seat the card-inspect button had — the
 *  one verb nobody reaches for mid-action, and the seat the player's thumb has
 *  already learned is "the harmless one".
 *
 *  Cancel never displaces the armed verb: if the armed verb IS in that seat (a
 *  Talent, which sits where CARD would), cancel takes the opposite one. Two
 *  chips can never collide, so the only rule needed is "not on top of each
 *  other".
 *
 *  Pure, and exported, because this is the whole of the behaviour and the
 *  component around it cannot be rendered in this repo's test setup. */
export function seatVerbs(
  verbs: WheelVerb[],
  armedKey?: string | null,
  cancel?: WheelVerb,
): SeatedVerb[] {
  const seated = verbs.slice(0, 4).map((v, i) => ({ ...v, seat: SEATS[i] }));
  if (!armedKey || !cancel) return seated;
  const armed = seated.find((v) => v.key === armedKey);
  // An armed key with no chip of its own (a mode the ring does not carry) leaves
  // the ring alone rather than collapsing to a lone Cancel: the player would
  // have no way to fire what they armed.
  if (!armed) return seated;
  const CARD_SEAT: WheelSeat = "left";
  return [armed, { ...cancel, seat: armed.seat === CARD_SEAT ? "right" : CARD_SEAT }];
}

export function ActionWheel(props: {
  /** Up to four. Order decides the seat: top, right, bottom, left. */
  verbs: WheelVerb[];
  /** Centre of the acting card, in viewport pixels. */
  at: { x: number; y: number } | null;
  /** The verb currently armed for its second press, if any. With `cancel`, this
   *  collapses the ring to that verb plus a way out — see `seatVerbs`. */
  armedKey?: string | null;
  /** The way out of an armed action. Only rendered while something is armed. */
  cancel?: WheelVerb;
  /** Tapping the board dismisses the ring; the parent decides what that means. */
  onDismiss?: () => void;
  children?: ReactNode;
}) {
  if (!props.at || props.verbs.length === 0) return null;
  const chips = seatVerbs(props.verbs, props.armedKey, props.cancel);
  // Collapsed: no scrim. The scrim exists to make four chips readable over four
  // slots, and those four slots are the targets the player is now trying to
  // see and tap.
  const collapsed = chips.length < props.verbs.slice(0, 4).length;

  // Keep the whole ring on screen. The design notes the arc "is placed away
  // from the board edge so the ring never falls off-screen" — on a 5x5 board a
  // card in the corner column is 35px from the edge and a 130px ring centred on
  // it would hang half off, so the centre is clamped rather than trusted.
  const R = 66;
  const x = Math.min(Math.max(props.at.x, R + 4), window.innerWidth - R - 4);
  const y = Math.min(Math.max(props.at.y, R + 4), window.innerHeight - R - 4);

  return (
    <div
      className={`wheel ${collapsed ? "collapsed" : ""}`}
      style={{ left: `${x}px`, top: `${y}px` }}
      role="group"
      aria-label="Card actions"
    >
      {!collapsed && <span className="wheel-ring" aria-hidden="true" />}
      {chips.map((v) => (
        <button
          key={v.key}
          className={`wheel-verb seat-${v.seat} ${v.armed ? "armed" : ""} ${v.key === "cancel" ? "is-cancel" : ""}`}
          style={{ ["--tone" as string]: v.tone }}
          disabled={v.disabled}
          title={v.title}
          onClick={(e) => { e.stopPropagation(); v.onClick(); }}
        >
          {v.short}
        </button>
      ))}
    </div>
  );
}
