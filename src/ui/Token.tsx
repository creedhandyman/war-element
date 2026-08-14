import { useEffect, useRef, useState } from "react";
import type { CardInstance, GameState, PlayerId } from "../engine";
import { auraSources, effectiveBasicHits, effectiveDmg, effectiveMaxHp, effectiveSp, getDef, isBloodfire, legalMoves } from "../engine";
import { EL_COLOR, KEYWORD_STYLE, STATUS_STYLE } from "./shared";
import { SpIcon } from "./icons";

/** One letter, because the tile has no room for a word and the marker only has
 *  to distinguish two states you already chose deliberately. The names are the
 *  card panel's job; this is the reminder. Manual never renders. */
const AUTO_LABEL = { manual: "M", basic: "A", full: "F" } as const;

/** Stable empty array for the damage-float hook's dependency: `?? []` would mint
 *  a new one every render and re-run the effect on every frame of the match. */
const EMPTY_HITS: readonly number[] = [];

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

/** Float one number per point of HP this card just lost — the readout that
 *  turns "the HP went down" into "it took 6, then 6, then 4".
 *
 *  A whole volley resolves inside ONE engine step, so React never sees the
 *  intermediate states. That is why the engine hands over a LIST of hits and a
 *  counter: the counter says how many entries are new since the last draw, and
 *  the tail of the list is what to float. Without it a three-hit attack could
 *  only ever show its last number.
 *
 *  The batch is drawn all at once and staggered in CSS (--i), so there is one
 *  timer per volley rather than one per number.
 */
function useDamageFloats(instanceId: string, seq: number, hits: readonly number[]) {
  const prevSeq = useRef(seq);
  const prevId = useRef(instanceId);
  const keyRef = useRef(0);
  const [batch, setBatch] = useState<{ key: number; nums: number[] } | null>(null);
  useEffect(() => {
    // A different card standing in this slot is not a card that took damage.
    if (prevId.current !== instanceId) {
      prevId.current = instanceId;
      prevSeq.current = seq;
      setBatch(null);
      return;
    }
    const fresh = seq - prevSeq.current;
    prevSeq.current = seq;
    if (fresh > 0) setBatch({ key: ++keyRef.current, nums: hits.slice(-fresh) });
  }, [seq, instanceId, hits]);
  useEffect(() => {
    if (!batch) return;
    // Must outlast the last number's delay plus its own animation.
    const t = setTimeout(() => setBatch(null), 820 + batch.nums.length * 130);
    return () => clearTimeout(t);
  }, [batch]);
  return batch;
}

/** Floats a "+1" coin off a card the moment it earns its home-slot income, or
 *  the moment it steps onto the home row and becomes able to. Same counter-rise
 *  trick as the others: the engine bumps `fxCoin`, a rise plays it once.
 *
 *  Keyed on a counter rather than on position so it cannot re-fire on an
 *  unrelated re-render, and reset when a different card occupies the slot. */
function useCoinFloat(instanceId: string, coin: number) {
  const prev = useRef({ coin, id: instanceId });
  const keyRef = useRef(0);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (prev.current.id !== instanceId) {
      prev.current = { coin, id: instanceId };
      setKey(0);
      return;
    }
    if (coin > prev.current.coin) setKey(++keyRef.current);
    prev.current = { coin, id: instanceId };
  }, [coin, instanceId]);
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => setKey(0), 1000);
    return () => clearTimeout(t);
  }, [key]);
  return key;
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

/** Every non-status buff/debuff currently on the card, as readable lines WITH
 *  their source — so a player can see where a +DMG or a −accuracy came from.
 *  Statuses (BURN, ROOT…) are shown as their own icons and excluded here. */
export function cardMods(game: GameState, card: CardInstance): { buffs: string[]; debuffs: string[] } {
  const buffs: string[] = [];
  const debuffs: string[] = [];
  for (const a of auraSources(game, card)) buffs.push(`${a.text} — ${a.name} (aura)`);
  for (const b of card.buffs ?? []) {
    const parts = [b.dmg ? `+${b.dmg} DMG` : "", b.sp ? `+${b.sp} SP` : ""].filter(Boolean);
    if (parts.length) buffs.push(`${parts.join(", ")} — timed (${b.rounds}r)`);
  }
  const permDmg = (card.dmgBonus ?? 0) + (card.dmgBonusRound ?? 0);
  const permSp = (card.spBonus ?? 0) + (card.spBonusRound ?? 0);
  if (permDmg > 0) buffs.push(`+${permDmg} DMG — growth`);
  if (permSp > 0) buffs.push(`+${permSp} SP — growth`);
  if (permDmg < 0) debuffs.push(`${permDmg} DMG`);
  if (permSp < 0) debuffs.push(`${permSp} SP`);
  if ((card.blockRoundsLeft ?? 0) > 0) buffs.push(`BLOCK ${card.blockPower} — ${card.blockRoundsLeft}r`);
  if ((card.reflectRoundsLeft ?? 0) > 0) buffs.push(`REFLECT ${card.reflectPower} — ${card.reflectRoundsLeft}r`);
  if ((card.guaranteedDodge ?? 0) > 0) buffs.push(`Guaranteed dodge ×${card.guaranteedDodge}`);
  if ((card.regenRoundsLeft ?? 0) > 0) buffs.push(`REGEN ${card.regenPower} — ${card.regenRoundsLeft}r`);
  if ((card.flyingRoundsLeft ?? 0) > 0) buffs.push(`FLYING — ${card.flyingRoundsLeft}r`);
  if ((card.attackMissRounds ?? 0) > 0) debuffs.push(`Aim shaken ${card.attackMissPct ?? 0}% — ${card.attackMissRounds}r`);
  if (card.hoaxMarked) debuffs.push(`Marked — basics against it are guaranteed crits`);
  if ((card.specialLockedRounds ?? 0) > 0) debuffs.push(`Special locked — ${card.specialLockedRounds}r`);
  return { buffs, debuffs };
}

export function Token(props: {
  game: GameState;
  card: CardInstance;
  viewer: PlayerId; // the local player's side — "mine" is relative to this, not always P1
  selected: boolean;
  acting: boolean;
  /** This card is held in foil by the local player. Purely cosmetic and purely
   *  a UI concern — the engine has no idea shinies exist, and it must not: a
   *  GameState is replayed and sent to the online peer, and what is in someone's
   *  collection is neither reproducible nor theirs to know. */
  foil?: boolean;
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
  const dmgFx = useDamageFloats(card.instanceId, card.fxDmgSeq ?? 0, card.fxDmgHits ?? EMPTY_HITS);
  const coinFx = useCoinFloat(card.instanceId, card.fxCoin ?? 0);
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
  const mods = cardMods(game, card);
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
    props.foil ? "foil-tok" : "",
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
      title={`${def.name} — click to inspect (full art, stats, Special & passives)${def.special ? `\n\n${def.special.name}: ${def.special.text}` : ""}`}
    >
      <img
        className="card-art"
        src={`/cards/${def.art ?? def.id}.webp`}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {/* A real element rather than ::after — the token already spends its
          ::after on the bottom scrim that keeps the stat row readable. */}
      {props.foil && <span className="tk-foil" aria-hidden="true" />}
      {combatFx && (
        <div key={combatFx.key} className={`fx-float fx-${combatFx.kind.toLowerCase()}`}>
          {combatFx.kind}
        </div>
      )}
      {/* Damage readout: one number per hit, dropping off the bottom of the card.
          CRIT/MISS rise; damage falls — the direction is the tell. A volley of
          two or more is followed by its total, so a three-hit special reads as
          one blow with a number on it. */}
      {coinFx > 0 && (
        <span key={`coin${coinFx}`} className="fx-coin">
          +1<i className="coin" />
        </span>
      )}
      {dmgFx && (
        <div key={dmgFx.key} className="fx-dmg-stack">
          {dmgFx.nums.map((n, i) => (
            <span key={i} className="fx-dmg" style={{ ["--i" as string]: i }}>
              −{n}
            </span>
          ))}
          {dmgFx.nums.length > 1 && (
            <span className="fx-dmg fx-dmg-total" style={{ ["--i" as string]: dmgFx.nums.length }}>
              −{dmgFx.nums.reduce((a, b) => a + b, 0)}
            </span>
          )}
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
      {(card.statuses.length > 0 || mods.buffs.length > 0 || mods.debuffs.length > 0) && (
        <div className="status-icons">
          {mods.buffs.length > 0 && (
            <span className="mod-chip buff" title={`BUFFS\n${mods.buffs.join("\n")}`}>▲{mods.buffs.length}</span>
          )}
          {isBloodfire(card) && (
            <span
              className="status-icon bloodfire"
              title="BLOODFIRE — bleeding AND burning. Blood-fire payoff cards hit this target harder."
            >
              🩸🔥
            </span>
          )}
          {card.statuses.map((s) => {
            const st = STATUS_STYLE[s.kind];
            return (
              <span
                key={s.kind}
                className="status-icon"
                style={{ borderColor: st.color, color: st.color }}
                title={`${s.kind}${s.power ? ` ${s.power}` : ""}${s.source ? ` from ${s.source}` : ""} — ${s.duration} round(s)`}
              >
                {st.glyph}{s.duration}
              </span>
            );
          })}
          {mods.debuffs.length > 0 && (
            <span className="mod-chip debuff" title={`DEBUFFS\n${mods.debuffs.join("\n")}`}>▼{mods.debuffs.length}</span>
          )}
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
            ⚔<span className="atk-dmg">{effectiveDmg(game, card)}</span>
            {effectiveBasicHits(card) > 1 ? <span className="atk-x"> ×{effectiveBasicHits(card)}</span> : ""}
          </span>
          {card.curShields > 0 && <span className="st-sh">🛡{card.curShields}</span>}
          <span
            className={`st-hp ${hpFlash === "down" ? "hp-hit" : hpFlash === "up" ? "hp-heal" : ""}`}
            title={`HP ${card.curHp} of ${effectiveMaxHp(game, card)}`}
          >
            {/* The "/max" is a separate span so the 5x5 board can hide it (see
                .board.tight in styles.css) — on a fifth-width tile it is the
                widest thing in the row and the least useful, and a stat row
                whose width changes the moment a card is wounded is what broke
                the layout in the first place. The tooltip still carries it. */}
            ♥{card.curHp}
            {card.curHp !== effectiveMaxHp(game, card) && (
              <span className="hp-max">/{effectiveMaxHp(game, card)}</span>
            )}
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
      {/* READ-ONLY. This used to be the control itself — tap to cycle
          manual/auto/full — which put a live setting on a 60px board tile where
          it was as easy to hit by accident as on purpose, right where you are
          also tapping to select and move. The setting lives in the card's own
          panel now; what stays here is the answer to "which of mine are on
          auto?", readable at a glance across the whole board. */}
      {mine && human && card.autoMode !== "manual" && (
        <div className={`auto-tag ${card.autoMode}`} title={`On ${card.autoMode} auto — change it in the card panel`}>
          {AUTO_LABEL[card.autoMode]}
        </div>
      )}
    </div>
  );
}
