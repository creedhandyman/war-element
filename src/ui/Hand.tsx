import type { GameState } from "../engine";
import { getDef, HAND_CAP } from "../engine";
import { EL_COLOR } from "./shared";

export function Hand(props: {
  game: GameState;
  selectedHandId: string | null;
  onPick: (handId: string) => void;
}) {
  const { game } = props;
  const p1 = game.players.P1;
  const myPrep = game.phase === "prep" && game.prep?.priority === "P1";
  return (
    <div className="hand">
      <div className="hand-head">
        <span>Your Hand · {p1.hand.length}/{HAND_CAP}</span>
        <span style={{ color: "var(--ink-faint)" }}>Deck {p1.deck.length}</span>
        <span style={{ color: "var(--ink-faint)" }}>
          Opp hand {game.players.P2.hand.length} · deck hidden
        </span>
      </div>
      <div className="hand-cards">
        {p1.hand.map((h) => {
          const def = getDef(h.defId);
          const affordable = def.cost <= p1.pool;
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
              className={cls}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(10,12,20,0.55), rgba(10,12,20,0.9) 70%), url(/cards/${def.id}.png)`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
              }}
              title={def.special ? `${def.special.name}: ${def.special.text}` : ""}
              onClick={() => props.onPick(h.handId)}
            >
              <div className="hc-top">
                <div className="hc-cost">{def.cost}</div>
                <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
              </div>
              <div className="hc-name">{def.name}</div>
              <div className="hc-stats">
                <span>⚔{def.hits > 1 ? `${def.hits}×` : ""}{def.dmg}</span>
                {def.shields > 0 && <span>🛡{def.shields}</span>}
                <span>♥{def.hp}</span>
                <span>👟{def.sp}</span>
              </div>
              <div className="hc-class">
                {def.cardClass} · {def.attackType}
              </div>
            </div>
          );
        })}
        {p1.hand.length === 0 && (
          <span style={{ color: "var(--ink-faint)", fontSize: 11, alignSelf: "center" }}>
            Hand empty.
          </span>
        )}
      </div>
    </div>
  );
}
