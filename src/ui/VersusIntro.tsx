/** The PvP versus screen — a beat between "connected" and "play" that shows
 *  what you are actually up against.
 *
 *  Online is the one mode where you have never seen the opposing deck. The
 *  Arena's versus card names both decks because YOU picked both; here the
 *  opponent is a stranger, the match previously opened straight into a mulligan,
 *  and the first thing you learned about their list was whatever walked onto the
 *  board in round two.
 *
 *  Built on `DeckSeat`, the Arena's own seat card, so this is the same object
 *  the player already knows — finisher art bleeding in from the right, the
 *  viewer-relative blue/red rim, the flag, the deck name, the element chips.
 *  Passing no `onChange` renders it as a locked panel rather than a dead button,
 *  which is exactly what a reveal wants. Under each seat sits the detail the
 *  Arena card has no room for: size, average cost, and the top of the curve —
 *  the cards this deck is built around and the ones worth bracing for.
 *
 *  THE CARD LISTS ARE DERIVED FROM THE GAME STATE — `deck` plus `hand`, which at
 *  deal time is the whole list — rather than from the deck ids each client
 *  happens to hold. The guest never receives the host's deck id, only the dealt
 *  state, so reading ids would have shown each player a different screen. The
 *  NAMES are the one thing the state cannot carry, so they ride along with it as
 *  `StateMeta` and the host relays both.
 */
import { useEffect, useState } from "react";
import { getDef } from "../data/cards";
import type { GameState, PlayerId } from "../engine";
import { DeckSeat } from "./DeckPickerSheet";

/** How long the screen holds before the match begins. Short on purpose — this
 *  is a flourish in front of a fight someone is waiting to play, and every
 *  second here is a second the other player is staring at the same thing. */
const HOLD_MS = 4200;

/** A seat's whole list: what is left in the deck plus what was just dealt. */
const readSide = (state: GameState, p: PlayerId): string[] =>
  [...state.players[p].deck, ...state.players[p].hand.map((h) => h.defId)];

function Detail(props: { cards: string[] }) {
  const { cards } = props;
  const avg = cards.length ? cards.reduce((s, id) => s + getDef(id).cost, 0) / cards.length : 0;
  // The top of the curve, dearest first.
  const top = [...cards].sort((a, b) => getDef(b).cost - getDef(a).cost).slice(0, 4);
  return (
    <div className="pvi-detail">
      <div className="pvi-meta">
        <span><b>{cards.length}</b> cards</span>
        <span>avg cost <b>{avg.toFixed(1)}</b></span>
      </div>
      <div className="pvi-top">
        {top.map((id, i) => {
          const d = getDef(id);
          return (
            <span className="pvi-card" key={`${id}-${i}`} data-el={d.element}>
              <b>{d.cost}</b>
              <em>{d.name}</em>
              <i>{d.dmg}×{d.hits} · {d.hp} HP</i>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function VersusIntro(props: {
  game: GameState;
  me: PlayerId;
  /** Both seats' deck names, relayed by the host. Absent only if the opening
   *  message was missed entirely, hence the fallbacks. */
  names: { P1: string; P2: string } | null;
  onDone: () => void;
}) {
  const { game, me, names, onDone } = props;
  const foe: PlayerId = me === "P1" ? "P2" : "P1";
  // Read ONCE at mount, so an opponent mulliganing while this is still up
  // cannot re-shuffle the panels under the player.
  const [mine] = useState(() => readSide(game, me));
  const [theirs] = useState(() => readSide(game, foe));

  useEffect(() => {
    const t = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="overlay on-top pvi-wrap" onClick={onDone}>
      <div className="pvi" onClick={(e) => e.stopPropagation()}>
        <div className="pvi-col">
          <DeckSeat side="mine" flag={`YOU · ${me}`} label={names?.[me] ?? "Your deck"} cards={mine} />
          <Detail cards={mine} />
        </div>

        <div className="pvi-mid">
          <span className="pvi-vs">VS</span>
          <span className="pvi-bar" aria-hidden="true"><i /></span>
          <button className="pvi-skip" onClick={onDone}>tap to skip</button>
        </div>

        <div className="pvi-col">
          <DeckSeat side="foe" flag={`OPPONENT · ${foe}`} label={names?.[foe] ?? "Their deck"} cards={theirs} />
          <Detail cards={theirs} />
        </div>
      </div>
    </div>
  );
}
