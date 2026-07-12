import { useEffect, useRef, useState } from "react";
import type { CardInstance, GameState } from "../engine";
import { effectiveBasicHits, effectiveDmg, effectiveSp, getDef, legalMoves } from "../engine";
import { EL_COLOR } from "./shared";
import { SpIcon } from "./icons";

const AUTO_LABEL = { manual: "MANUAL", basic: "AUTO", full: "FULL" } as const;

/** Flash the HP number red when it drops (damage) and green when it rises
 *  (healing), so combat reads at a glance. Ignores same-slot card swaps. */
function useHpFlash(instanceId: string, hp: number): "down" | "up" | null {
  const prevHp = useRef(hp);
  const prevId = useRef(instanceId);
  const [flash, setFlash] = useState<"down" | "up" | null>(null);
  useEffect(() => {
    if (prevId.current !== instanceId) {
      prevId.current = instanceId;
      prevHp.current = hp;
      setFlash(null);
      return;
    }
    const prev = prevHp.current;
    prevHp.current = hp;
    if (hp < prev) setFlash("down");
    else if (hp > prev) setFlash("up");
  }, [hp, instanceId]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(t);
  }, [flash]);
  return flash;
}

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
  const hpFlash = useHpFlash(card.instanceId, card.curHp);
  // Attack spotlight: during Battle, the card at the front of the speed queue is
  // the one taking its turn — grow it slightly so you can see who's acting.
  const battle = game.battle;
  const isAttacking =
    game.phase === "battle" &&
    !!battle &&
    battle.index < battle.queue.length &&
    battle.queue[battle.index] === card.instanceId;
  // Move indicator: the SP stat glows while this card's owner may still move it.
  const canMoveNow =
    human &&
    game.phase === "prep" &&
    game.prep?.priority === card.owner &&
    !game.prep.movedThisTurn &&
    legalMoves(game, card.owner, card.instanceId).length > 0;
  const kws = Object.entries(def.keywords)
    .map(([k, v]) => (v === true ? k : `${k} ${v}`))
    .join(" · ");
  const cls = [
    "token",
    mine ? "mine" : "enemy",
    props.selected ? "selected" : "",
    props.acting ? "acting" : "",
    isAttacking ? "attacking" : "",
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
      {/* Top: name (with cost + element dot). */}
      <div className="tk-top">
        <span className="tk-cost">{def.cost}</span>
        <span className="tk-name">{def.name}</span>
        <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
      </div>
      {/* Bottom: class line + the full stat row (DMG · shield · HP · SP). */}
      <div className="tk-bottom">
        <div className="tk-class" title={`${def.cardClass} · ${def.attackType}`}>
          {def.attackType === "Melee" ? "🗡" : "🏹"} {def.cardClass.toUpperCase()}
        </div>
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
          <span
            className={`st-hp ${hpFlash === "down" ? "hp-hit" : hpFlash === "up" ? "hp-heal" : ""}`}
            title={`HP ${card.curHp} of ${card.maxHp}`}
          >
            ♥{card.curHp === card.maxHp ? card.curHp : `${card.curHp}/${card.maxHp}`}
          </span>
          <span
            className={`st-sp ${canMoveNow ? "can-move" : ""}`}
            title={
              canMoveNow
                ? "Can move this turn — click the card, then a green slot"
                : "Speed (queue order + move reach)"
            }
          >
            <SpIcon />
            {effectiveSp(game, card)}
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
    </div>
  );
}
