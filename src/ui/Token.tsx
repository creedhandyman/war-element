import type { CardInstance, GameState } from "../engine";
import { effectiveSp, getDef } from "../engine";
import { EL_COLOR } from "./shared";

const AUTO_LABEL = { manual: "MANUAL", basic: "AUTO", full: "FULL" } as const;

export function Token(props: {
  game: GameState;
  card: CardInstance;
  selected: boolean;
  acting: boolean;
  onCycleAuto: (instanceId: string) => void;
}) {
  const { game, card } = props;
  const def = getDef(card.defId);
  const mine = card.owner === "P1";
  const kws = Object.entries(def.keywords)
    .map(([k, v]) => (v === true ? k : `${k} ${v}`))
    .join(" · ");
  const cls = [
    "token",
    mine ? "mine" : "enemy",
    props.selected ? "selected" : "",
    props.acting ? "acting" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} title={def.special ? `${def.special.name}: ${def.special.text}` : def.name}>
      {card.status && (
        <div
          className="status-pip"
          title={`${card.status.kind} ${card.status.power || ""} — ${card.status.duration} round(s)`}
        >
          {card.status.kind.slice(0, 3)}·{card.status.duration}
        </div>
      )}
      <div className="tk-top">
        <div className="tk-cost">{def.cost}</div>
        <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
      </div>
      <div className="tk-name">{def.name}</div>
      <div>
        {kws && <div className="kw-line">{kws}</div>}
        <div className="tk-stats">
          <span className="st-dmg" title="Damage per hit × hits">
            ⚔{def.dmg}
            {def.hits > 1 ? `×${def.hits}` : ""}
          </span>
          {card.curShields > 0 && <span className="st-sh">🛡{card.curShields}</span>}
          <span className="st-hp" title={`HP ${card.curHp} of ${card.maxHp}`}>
            ♥{card.curHp === card.maxHp ? card.curHp : `${card.curHp}/${card.maxHp}`}
          </span>
        </div>
      </div>
      {mine && (
        <div
          className={`auto-btn ${card.autoMode}`}
          title={`Auto mode: ${card.autoMode} — click to cycle`}
          onClick={(e) => {
            e.stopPropagation();
            props.onCycleAuto(card.instanceId);
          }}
        >
          {AUTO_LABEL[card.autoMode]}
        </div>
      )}
      <div className="sp-badge">👟{effectiveSp(game, card)}</div>
    </div>
  );
}
