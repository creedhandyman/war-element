import { useEffect, useState } from "react";
import type { GameState, PlayerId } from "../engine";
import { getDef } from "../engine";
import { EL_ICON } from "./shared";
import { SpIcon } from "./icons";

/** True on phone-width viewports (≤760px wide) OR short viewports (≤540px tall,
 *  i.e. a landscape phone). Mirrors the CSS mobile + landscape breakpoints — both
 *  width/height only, no `orientation` (flaky on real devices) — so the fan
 *  tightens the same way. Re-renders on resize/orientation change. */
const NARROW_QUERY = "(max-width: 760px), (max-height: 540px)";
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return narrow;
}

export function Hand(props: {
  game: GameState;
  player: PlayerId;
  /** Hand ids the ENGINE says are summonable right now (App asks canSummon over
   *  every column — the same rule that lights up the Home slots). The hand does
   *  not re-derive this: `cost <= gold` is only half of it, and a card that
   *  passes that half with a full Home row is a card the board will refuse. */
  summonableHandIds: ReadonlySet<string>;
  /** False = no Home slot is free at all, so every card is stuck for the same
   *  board-side reason. Styled apart from "can't afford it" because the player
   *  fixes the two differently: make space vs. wait for Gold. */
  homeRowOpen: boolean;
  selectedHandId: string | null;
  /** Card ids the local player holds in foil. The BOARD already shines these;
   *  without the same set here a foil went dull the moment it was in your hand
   *  and lit up again when you played it, in the same match, on the same
   *  screen. Cosmetic and UI-only, exactly as on the board. */
  foils?: ReadonlySet<string>;
  onPick: (handId: string) => void;
  onDragStartCard?: (handId: string) => void;
  onDragEndCard?: () => void;
}) {
  const { game, player } = props;
  const me = game.players[player];
  const myPrep = game.phase === "prep" && game.prep?.priority === player;
  const n = me.hand.length;
  const center = (n - 1) / 2;
  // Phones get a tighter fan + shallower dip so even a hoarded 9-card hand stays
  // within the viewport and clears the bottom control bar.
  const narrow = useNarrow();
  // The fan has to stay inside the viewport as the hand GROWS. Both the spread
  // and the dip used to scale with the card's distance from centre, unbounded —
  // a 5-card hand dipped ~18px but a 9-card hand dipped ~49px and the outer
  // cards fell off the bottom of the screen (stat lines unreadable by round 3-4).
  // So: shrink the per-card step once the hand is big, and hard-CLAMP the dip.
  const wide = n > 5 ? Math.max(0.55, 5 / n) : 1; // tighten as the hand grows
  const rotStep = (narrow ? 3.2 : 4.4) * wide;
  const tyStep = (narrow ? 3.5 : 7) * wide;
  const tyMax = narrow ? 14 : 22; // the fan never dips further than this

  return (
    <div className={`hand${myPrep ? "" : " collapsed"}`}>
      {/* Deck as a stacked pile with its count. */}
      <div className="deck-stack" title={`Your deck — ${me.deck.length} cards`}>
        <span className="ds-plate" />
        <span className="ds-plate" />
        <span className="ds-face">
          <span className="ds-count">{me.deck.length}</span>
          <span className="ds-lbl">DECK</span>
        </span>
      </div>

      <div className="hand-fan">
        {me.hand.map((h, i) => {
          const def = getDef(h.defId);
          const summonable = props.summonableHandIds.has(h.handId);
          // Two locked states, two fixes. `noroom` = the board is full, so make
          // space; `unaffordable` = the card is out of reach, so bank Gold. The
          // Gold veil is suppressed for anything the engine says IS summonable,
          // because the free opening placement spends slots, not Gold.
          const noRoom = myPrep && !summonable && !props.homeRowOpen;
          const unaffordable = def.cost > me.gold && !summonable && !noRoom;
          const off = i - center;
          const rot = off * rotStep; // fan spread (deg)
          const ty = Math.min(tyMax, Math.pow(Math.abs(off), 1.4) * tyStep); // outer cards dip lower (clamped)
          const cls = [
            "hcard",
            summonable ? "summonable" : "",
            unaffordable ? "unaffordable" : "",
            noRoom ? "noroom" : "",
            props.selectedHandId === h.handId ? "selected" : "",
            props.foils?.has(def.id) ? "foil" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={h.handId}
              className={`${cls} carded`}
              data-el={def.element}
              style={{
                ["--rot" as string]: `${rot}deg`,
                ["--ty" as string]: `${ty}px`,
                // STRICTLY increasing left to right, so every card sits above
                // the one to its left and its own left edge stays on top. It
                // used to peak at the CENTRE (30 - |off|*2), which reads fine
                // as a fan and quietly hid half the hand's costs: the gem is at
                // the card's top-LEFT, cards overlap by their full 28-38px
                // margin, and every card RIGHT of centre was underneath its
                // left neighbour — so its gem was covered and only the left
                // half of the hand showed a price.
                zIndex: 30 + i,
              }}
              title={
                noRoom
                  ? `${def.name} — no free Home slot`
                  : def.special
                    ? `${def.special.name}: ${def.special.text}`
                    : def.name
              }
              draggable={summonable}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", h.handId);
                e.dataTransfer.effectAllowed = "move";
                props.onDragStartCard?.(h.handId);
              }}
              onDragEnd={() => props.onDragEndCard?.()}
              onClick={() => props.onPick(h.handId)}
            >
              <img
                className="card-art"
                src={`/cards/${def.art ?? def.id}.webp`}
                alt=""
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              {/* Cost and element are one mark now. The RING still carries
                   affordability (gold vs red) — that is a gameplay signal and
                   it does not move onto the art. */}
              <div className="hc-cost" style={{ backgroundImage: `url(${EL_ICON[def.element]})` }}>
                <b>{def.cost}</b>
              </div>
              {props.foils?.has(def.id) && <i className="foil-tag" title="Foil">✦</i>}
              <div className="hc-plate">
                <div className="hc-name">{def.name}</div>
                <div className="hc-type">{def.cardClass} · {def.attackType}</div>
                <div className="hc-stats">
                  <span className="s-dmg">⚔<span className="atk-dmg">{def.dmg}</span>{def.hits > 1 ? <span className="atk-x"> ×{def.hits}</span> : ""}</span>
                  <span className="s-hp">♥{def.hp}</span>
                  {def.shields > 0 && <span className="s-sh">🛡{def.shields}</span>}
                  <span className="s-sp"><SpIcon />{def.sp}</span>
                </div>
              </div>
            </div>
          );
        })}
        {n === 0 && <span className="hand-empty">Hand empty.</span>}
      </div>

      {/* Say it once, up front. A full Home row makes the whole hand unplayable,
          and the player shouldn't have to tap a card to find that out. */}
      {myPrep && n > 0 && !props.homeRowOpen && (
        <span className="hand-note">Home row full — move a card forward to free a slot.</span>
      )}
    </div>
  );
}
