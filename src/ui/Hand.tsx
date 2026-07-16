import { useEffect, useState } from "react";
import type { GameState, PlayerId } from "../engine";
import { getDef } from "../engine";
import { EL_COLOR, EL_SIGIL } from "./shared";
import { SpIcon } from "./icons";

/** True on phone-width viewports (portrait ≤760px) AND on short landscape phones
 *  (which can be wider than 760px but are height-constrained). Matches the CSS
 *  mobile + landscape breakpoints so the fan tightens the same way. Re-renders on
 *  resize/orientation change so it re-tightens live. */
const NARROW_QUERY = "(max-width: 760px), (orientation: landscape) and (max-height: 540px)";
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
  selectedHandId: string | null;
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
  const rotStep = narrow ? 3.2 : 4.4;
  const tyStep = narrow ? 3.5 : 7;

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
          const affordable = def.cost <= me.summonPool;
          const off = i - center;
          const rot = off * rotStep; // fan spread (deg)
          const ty = Math.pow(Math.abs(off), 1.4) * tyStep; // outer cards dip lower
          const cls = [
            "hcard",
            myPrep && affordable ? "summonable" : "",
            !affordable ? "unaffordable" : "",
            props.selectedHandId === h.handId ? "selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={h.handId}
              className={`${cls} carded`}
              style={{
                ["--rot" as string]: `${rot}deg`,
                ["--ty" as string]: `${ty}px`,
                ["--el" as string]: EL_COLOR[def.element],
                zIndex: 30 - Math.round(Math.abs(off) * 2),
              }}
              title={def.special ? `${def.special.name}: ${def.special.text}` : def.name}
              draggable={myPrep && affordable}
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
                src={`/cards/${def.art ?? def.id}.png`}
                alt=""
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <div className="hc-cost">{def.cost}</div>
              <div className="hc-sigil" style={{ color: EL_COLOR[def.element] }}>
                {EL_SIGIL[def.element]}
              </div>
              <div className="hc-plate">
                <div className="hc-name">{def.name}</div>
                <div className="hc-type">{def.cardClass} · {def.attackType}</div>
                <div className="hc-stats">
                  <span className="s-dmg">⚔{def.hits > 1 ? `${def.hits}×` : ""}{def.dmg}</span>
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
    </div>
  );
}
