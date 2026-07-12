import type { GameState, PlayerId } from "../engine";
import { enemyOf, getDef } from "../engine";
import { EL_COLOR } from "./shared";
import { SpIcon } from "./icons";

export function Hand(props: {
  game: GameState;
  player: PlayerId;
  selectedHandId: string | null;
  onPick: (handId: string) => void;
}) {
  const { game, player } = props;
  const me = game.players[player];
  const opp = game.players[enemyOf(player)];
  const twoP = (game.humans ?? ["P1"]).length > 1;
  const myPrep = game.phase === "prep" && game.prep?.priority === player;
  return (
    <div className="hand">
      <div className="hand-head">
        <span>{twoP ? `${player} Hand` : "Your Hand"} · {me.hand.length}</span>
        <span style={{ color: "var(--ink-faint)" }}>Deck {me.deck.length}</span>
        <span style={{ color: "var(--ink-faint)" }}>
          Opp hand {opp.hand.length} · deck hidden
        </span>
      </div>
      <div className="hand-cards">
        {me.hand.map((h) => {
          const def = getDef(h.defId);
          const affordable = def.cost <= me.summonPool;
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
              title={def.special ? `${def.special.name}: ${def.special.text}` : ""}
              onClick={() => props.onPick(h.handId)}
            >
              <img
                className="card-art"
                src={`/cards/${def.id}.png`}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="hc-top">
                <div className="hc-cost">{def.cost}</div>
                <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
              </div>
              <div className="hc-name">{def.name}</div>
              <div className="hc-stats">
                <span>⚔{def.hits > 1 ? `${def.hits}×` : ""}{def.dmg}</span>
                {def.shields > 0 && <span>🛡{def.shields}</span>}
                <span>♥{def.hp}</span>
                <span><SpIcon />{def.sp}</span>
              </div>
              <div className="hc-class">
                {def.cardClass} · {def.attackType}
              </div>
            </div>
          );
        })}
        {me.hand.length === 0 && (
          <span style={{ color: "var(--ink-faint)", fontSize: 11, alignSelf: "center" }}>
            Hand empty.
          </span>
        )}
      </div>
    </div>
  );
}
