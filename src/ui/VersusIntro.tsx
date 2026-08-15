/** The PvP versus screen — a beat between "connected" and "play" that shows
 *  what you are actually up against.
 *
 *  Online is the one mode where you have never seen the opposing deck. The
 *  Arena's own versus card names both decks because YOU picked both; here the
 *  opponent is a stranger, the match previously opened straight into a mulligan,
 *  and the first thing you learned about their list was whatever walked onto the
 *  board in round two.
 *
 *  BOTH SIDES ARE DERIVED FROM THE GAME STATE — `deck` plus `hand`, which at
 *  deal time is the whole list — rather than from the deck ids each client
 *  happens to hold. The guest never receives the host's deck id (only the dealt
 *  state), so reading ids would have shown each player a different screen. This
 *  way the two clients render the same thing from the same source.
 *
 *  Deliberately no deck NAME: it is not in the state, and transmitting it would
 *  be a second source of truth for the same question. The elements and the top
 *  of the curve say more about a list than its name does anyway.
 */
import { useEffect, useState } from "react";
import { getDef } from "../data/cards";
import type { Element, GameState, PlayerId } from "../engine";
import { EL_COLOR, EL_ICON } from "./shared";

/** How long the screen holds before the match begins. Short on purpose — this
 *  is a flourish in front of a fight someone is waiting to play, and every
 *  second here is a second the other player is staring at the same thing. */
const HOLD_MS = 4200;

interface Side {
  cards: string[];
  elements: { el: Element; n: number }[];
  top: string[];
  avgCost: number;
}

/** A seat's whole list: what is left in the deck plus what was just dealt. */
function readSide(state: GameState, p: PlayerId): Side {
  const cards = [...state.players[p].deck, ...state.players[p].hand.map((h) => h.defId)];
  const counts = new Map<Element, number>();
  for (const id of cards) {
    const el = getDef(id).element as Element;
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  const elements = [...counts.entries()]
    .map(([el, n]) => ({ el, n }))
    .sort((a, b) => b.n - a.n);
  // The top of the curve — the cards this deck is actually built around, and
  // the ones worth bracing for.
  const top = [...cards].sort((a, b) => getDef(b).cost - getDef(a).cost).slice(0, 4);
  const avgCost = cards.length
    ? cards.reduce((s, id) => s + getDef(id).cost, 0) / cards.length
    : 0;
  return { cards, elements, top, avgCost };
}

function SidePanel(props: { side: Side; label: string; mine: boolean }) {
  const { side } = props;
  return (
    <div className={`pvi-side ${props.mine ? "mine" : "theirs"}`}>
      <span className="pvi-seat">{props.label}</span>
      <div className="pvi-els">
        {side.elements.map(({ el, n }) => (
          <span key={el} className="pvi-el" style={{ borderColor: EL_COLOR[el] }}>
            <i style={{ backgroundImage: `url(${EL_ICON[el]})` }} aria-hidden="true" />
            <b style={{ color: EL_COLOR[el] }}>{n}</b>
          </span>
        ))}
      </div>
      <div className="pvi-meta">
        <span>{side.cards.length} cards</span>
        <span>avg {side.avgCost.toFixed(1)}</span>
      </div>
      <div className="pvi-top">
        {side.top.map((id, i) => {
          const d = getDef(id);
          return (
            <span className="pvi-card" key={`${id}-${i}`} style={{ borderColor: EL_COLOR[d.element as Element] }}>
              <b>{d.cost}</b>
              <em>{d.name}</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function VersusIntro(props: { game: GameState; me: PlayerId; onDone: () => void }) {
  const { game, me, onDone } = props;
  const foe: PlayerId = me === "P1" ? "P2" : "P1";
  const [mine] = useState(() => readSide(game, me));
  const [theirs] = useState(() => readSide(game, foe));

  // Auto-dismiss. Read once from the state it mounted with (the useState
  // initialisers above) so a mid-animation broadcast — the opponent mulliganing
  // while this is still up — cannot re-shuffle the panels under the player.
  useEffect(() => {
    const t = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="overlay on-top pvi-wrap" onClick={onDone}>
      <div className="pvi" onClick={(e) => e.stopPropagation()}>
        <SidePanel side={mine} label="YOU" mine />
        <div className="pvi-mid">
          <span className="pvi-vs">VS</span>
          <span className="pvi-bar" aria-hidden="true"><i /></span>
          <span className="pvi-skip" onClick={onDone}>tap to skip</span>
        </div>
        <SidePanel side={theirs} label="OPPONENT" mine={false} />
      </div>
    </div>
  );
}
