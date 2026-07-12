import type { CardInstance, GameState } from "../engine";
import { effectiveBasicHits, effectiveDmg, effectiveSp, getDef, legalMoves } from "../engine";
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
  const human = (game.humans ?? ["P1"]).includes(card.owner);
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
  // Card art renders as a real <img> (best downsampling quality) beneath a
  // bottom scrim (::after) so the top art stays clear and the stat row stays
  // readable. Drop a PNG named <defId>.png into public/cards/; a missing file
  // hides the <img> and the flat token shows through.
  return (
    <div
      className={cls}
      title={def.special ? `${def.special.name}: ${def.special.text}` : def.name}
    >
      <img
        className="card-art"
        src={`/cards/${def.id}.png`}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {card.statuses.map((s, i) => (
        <div
          key={s.kind}
          className="status-pip"
          style={{ top: 28 + i * 20 }}
          title={`${s.kind} ${s.power || ""} — ${s.duration} round(s)`}
        >
          {s.kind.slice(0, 3)}·{s.duration}
        </div>
      ))}
      <div className="tk-top">
        <div className="tk-cost">{def.cost}</div>
        <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
      </div>
      <div className="tk-name">{def.name}</div>
      <div className="tk-class" title={`${def.cardClass} · ${def.attackType}`}>
        {def.attackType === "Melee" ? "🗡" : "🏹"} {def.cardClass.toUpperCase()}
      </div>
      <div className="tk-bottom">
        {kws && <div className="kw-line">{kws}</div>}
        <div className="tk-stats">
          <span
            className="st-dmg"
            title={`Hits × damage per hit (printed ${def.dmg}/hit; live value includes Mid-row control and statuses)`}
          >
            ⚔{effectiveBasicHits(card) > 1 ? `${effectiveBasicHits(card)}×` : ""}
            {effectiveDmg(game, card)}
          </span>
          {card.curShields > 0 && <span className="st-sh">🛡{card.curShields}</span>}
          <span className="st-hp" title={`HP ${card.curHp} of ${card.maxHp}`}>
            ♥{card.curHp === card.maxHp ? card.curHp : `${card.curHp}/${card.maxHp}`}
          </span>
        </div>
      </div>
      {human && (
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
      {(() => {
        // Move indicator: glow the speed badge while this card's owner may still
        // move it (their prep turn, human-controlled). Works for P1 vs-AI and
        // for either side in hot-seat 2-player.
        const canMoveNow =
          human &&
          game.phase === "prep" &&
          game.prep?.priority === card.owner &&
          !game.prep.movedThisTurn &&
          legalMoves(game, card.owner, card.instanceId).length > 0;
        return (
          <div
            className={`sp-badge ${canMoveNow ? "can-move" : ""}`}
            title={
              canMoveNow
                ? "Can move this turn — click the card, then a green slot"
                : "Speed (queue order + move reach)"
            }
          >
            👟{effectiveSp(game, card)}
          </div>
        );
      })()}
    </div>
  );
}
