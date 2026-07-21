import { useEffect, useRef, useState } from "react";
import type { CardInstance, GameState, PlayerId } from "../engine";
import { effectiveBasicHits, effectiveDmg, effectiveMaxHp, effectiveSp, getDef, legalMoves } from "../engine";
import { EL_COLOR, KEYWORD_STYLE, STATUS_STYLE } from "./shared";
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

/** Float a "CRIT" / "MISS" tag over the token when the engine's per-card fx
 *  counters tick up (a crit landed / a hit was dodged). CRIT wins if both
 *  happened in the same resolve. */
function useCombatFx(instanceId: string, miss: number, crit: number) {
  const prevMiss = useRef(miss);
  const prevCrit = useRef(crit);
  const prevId = useRef(instanceId);
  const keyRef = useRef(0);
  const [fx, setFx] = useState<{ kind: "CRIT" | "MISS"; key: number } | null>(null);
  useEffect(() => {
    if (prevId.current !== instanceId) {
      prevId.current = instanceId;
      prevMiss.current = miss;
      prevCrit.current = crit;
      setFx(null);
      return;
    }
    let kind: "CRIT" | "MISS" | null = null;
    if (crit > prevCrit.current) kind = "CRIT";
    else if (miss > prevMiss.current) kind = "MISS";
    prevMiss.current = miss;
    prevCrit.current = crit;
    if (kind) setFx({ kind, key: ++keyRef.current });
  }, [miss, crit, instanceId]);
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), 800);
    return () => clearTimeout(t);
  }, [fx]);
  return fx;
}

/** A one-shot motion class for auras that deal damage with no battle turn
 *  behind them, so the HP change isn't unexplained. Same counter trick as
 *  useCombatFx: the engine bumps a number, a rise plays the animation once.
 *  The class is stripped again after the keyframes finish, so the next trigger
 *  re-adds it and restarts cleanly — no render key, which would remount the
 *  token and reload its art. */
function useMotionFx(instanceId: string, lunge: number, recoil: number) {
  const prev = useRef({ lunge, recoil, id: instanceId });
  const [fx, setFx] = useState<{ cls: "lunging" | "recoiling" } | null>(null);
  useEffect(() => {
    if (prev.current.id !== instanceId) {
      prev.current = { lunge, recoil, id: instanceId };
      setFx(null);
      return;
    }
    let cls: "lunging" | "recoiling" | null = null;
    if (lunge > prev.current.lunge) cls = "lunging";
    else if (recoil > prev.current.recoil) cls = "recoiling";
    prev.current = { lunge, recoil, id: instanceId };
    if (cls) setFx({ cls });
  }, [lunge, recoil, instanceId]);
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), 420); // must outlast the keyframes
    return () => clearTimeout(t);
  }, [fx]);
  return fx;
}

export function Token(props: {
  game: GameState;
  card: CardInstance;
  viewer: PlayerId; // the local player's side — "mine" is relative to this, not always P1
  selected: boolean;
  acting: boolean;
  onCycleAuto: (instanceId: string) => void;
}) {
  const { game, card } = props;
  const def = getDef(card.defId);
  // "Mine" is from the local viewer's seat (fixes the P2 guest, who used to see
  // their own cards flagged as enemy and the opponent's as theirs).
  const mine = card.owner === props.viewer;
  const human = (game.humans ?? ["P1"]).includes(card.owner);
  const hpFlash = useHpFlash(card.instanceId, card.curHp);
  const combatFx = useCombatFx(card.instanceId, card.fxMiss ?? 0, card.fxCrit ?? 0);
  const motionFx = useMotionFx(card.instanceId, card.fxLunge ?? 0, card.fxRecoil ?? 0);
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
  // Keyword pips (top edge) — visual glyphs, not words.
  const kwPips = Object.entries(def.keywords)
    .filter(([, v]) => v)
    .map(([k]) => ({ k, style: KEYWORD_STYLE[k] }))
    .filter((x) => x.style);
  const frozen = card.statuses.some((s) => s.kind === "FREEZE");
  const cls = [
    "token",
    mine ? "mine" : "enemy",
    props.selected ? "selected" : "",
    props.acting ? "acting" : "",
    isAttacking ? "attacking" : "",
    // Lunge fires toward the enemy, which is UP the screen for the viewer's own
    // cards and DOWN for the opponent's — the board is drawn viewer-home-at-
    // bottom, so the direction has to follow `mine`, not the owner id.
    motionFx ? `${motionFx.cls} ${mine ? "fx-up" : "fx-down"}` : "",
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
      style={{ ["--el-rim" as string]: EL_COLOR[def.element] }}
      title={def.special ? `${def.special.name}: ${def.special.text}` : def.name}
    >
      <img
        className="card-art"
        src={`/cards/${def.art ?? def.id}.png`}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {combatFx && (
        <div key={combatFx.key} className={`fx-float fx-${combatFx.kind.toLowerCase()}`}>
          {combatFx.kind}
        </div>
      )}
      {frozen && <div className="freeze-overlay" />}
      {kwPips.length > 0 && (
        <div className="kw-pips">
          {kwPips.map(({ k, style }) => (
            <span key={k} className="kw-pip" style={{ borderColor: style.color, color: style.color }} title={k}>
              {style.glyph}
            </span>
          ))}
        </div>
      )}
      {card.statuses.length > 0 && (
        <div className="status-icons">
          {card.statuses.map((s) => {
            const st = STATUS_STYLE[s.kind];
            return (
              <span
                key={s.kind}
                className="status-icon"
                style={{ borderColor: st.color, color: st.color }}
                title={`${s.kind} ${s.power || ""} — ${s.duration} round(s)`}
              >
                {st.glyph}{s.duration}
              </span>
            );
          })}
        </div>
      )}
      {/* Top: name (with cost + element dot). */}
      {/* Element is shown by the card's border rim (--el-rim), so no separate
          colour chip here — it only crowded the name on small board tiles. */}
      <div className="tk-top">
        <span className="tk-cost">{def.cost}</span>
        <span className="tk-name">{def.name}</span>
      </div>
      {/* Bottom: class line + the full stat row (DMG · shield · HP · SP). */}
      <div className="tk-bottom">
        <div className="tk-class" title={`${def.cardClass} · ${def.attackType}`}>
          {def.attackType === "Melee" ? "🗡" : "🏹"} {def.cardClass.toUpperCase()}
        </div>
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
            title={`HP ${card.curHp} of ${effectiveMaxHp(game, card)}`}
          >
            ♥{card.curHp === effectiveMaxHp(game, card) ? card.curHp : `${card.curHp}/${effectiveMaxHp(game, card)}`}
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
      {mine && human && (
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
