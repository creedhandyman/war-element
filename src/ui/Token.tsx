import { useEffect, useRef, useState } from "react";
import type { CardInstance, GameState, PlayerId } from "../engine";
import { auraSources, effectiveBasicHits, effectiveDmg, effectiveMaxHp, effectiveSp, fieldFlag, getDef, hasTotemSpirit, isBloodfire, legalMoves } from "../engine";
import { KEYWORD_STYLE, STATUS_STYLE } from "./shared";

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

/** A keyword the card was GIVEN rather than printed with, and how long it holds.
 *
 *  These used to be folded into the generic ▲N buff count, which meant the board
 *  showed "this card has three good things" when what an attacker actually needed
 *  to know was REFLECT 2, for two more rounds. They are pulled out so the tile can
 *  name them and show the timer — and removed from `cardMods` below, or they would
 *  be counted twice.
 *
 *  Only per-card timers live here. BLOCK/REFLECT handed out by a standing FIELD
 *  (Bedrock) or a wall are not per-card and have no counter of their own; they
 *  expire with the field, and the field already draws its own marker on the board.
 */
export interface GrantedKeyword {
  kw: string;
  /** Rounds remaining, or null when it is a charge count rather than a timer. */
  rounds: number | null;
  /** Charges left, for the one grant that is counted rather than timed. */
  charges?: number;
  power?: number;
  label: string;
}

export function grantedKeywords(card: CardInstance): GrantedKeyword[] {
  const out: GrantedKeyword[] = [];
  const timed = (kw: string, rounds: number | undefined, power: number | undefined) => {
    if (!rounds || rounds <= 0) return;
    const p = power ?? 0;
    out.push({
      kw, rounds, power: p,
      label: `${kw}${p ? ` ${p}` : ""} — ${rounds} round(s) left`,
    });
  };
  timed("BLOCK", card.blockRoundsLeft, card.blockPower);
  timed("REFLECT", card.reflectRoundsLeft, card.reflectPower);
  timed("REGEN", card.regenRoundsLeft, card.regenPower);
  timed("FLYING", card.flyingRoundsLeft, undefined);
  // Blur is charges, not rounds: it lasts until it is spent, however many rounds
  // that takes. Showing it as "2r" would be a lie, so it carries a x instead.
  const dodge = card.guaranteedDodge ?? 0;
  if (dodge > 0)
    out.push({
      kw: "EVASION", rounds: null, charges: dodge,
      label: `Guaranteed dodge — ${dodge} charge(s), until spent`,
    });
  return out;
}

/** Every non-status buff/debuff currently on the card, as readable lines WITH
 *  their source — so a player can see where a +DMG or a −accuracy came from.
 *  Statuses (BURN, ROOT…) and granted keywords are shown as their own marks and
 *  are excluded here. */
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
  // Granted keywords are NOT listed here — see grantedKeywords() above. They are
  // named and timed on the tile itself instead of hiding inside a ▲N count.
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
  // Same bump-a-counter shape as the coin float — a PARALYZE that actually cost
  // the card its turn floats the word, so a turn that produced nothing reads as
  // the coin it was rather than as the game skipping a beat.
  const zapFx = useCoinFloat(card.instanceId, card.fxParalyzed ?? 0);
  // The other direction: a swing that SHOULD have been shrugged off and was not,
  // because Blazing Sun or a Totem is holding. The card still wears its BLIND
  // pip — the field does not remove the status, it ignores it — so without this
  // the promise "cannot miss" is kept entirely off-screen.
  const trueFx = useCoinFloat(card.instanceId, card.fxNeverMiss ?? 0);
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
  const frozen = card.statuses.some((s) => s.kind === "FREEZE");
  const mods = cardMods(game, card);
  // Keywords stay on the board card. They ride the RIGHT edge, opposite the
  // statuses, so the two never compete for the same space: what the card IS on
  // one side, what is currently HAPPENING to it on the other. No overflow rule
  // is needed here — no card in the set carries more than two keywords (only
  // seven carry two at all), so the column is bounded by the data.
  const kwPips = Object.entries(def.keywords)
    .filter(([, v]) => v)
    .map(([k]) => ({ k, style: KEYWORD_STYLE[k] }))
    .filter((x) => x.style);
  // Every CHANGING mark, in one ordered list, so the tile can show the first
  // two and count the rest instead of wrapping an unbounded strip across the
  // art — a wounded card could print five chips over the thing you are reading.
  const granted = grantedKeywords(card);
  const pips: { key: string; glyph: string; color: string; title: string; cls?: string }[] = [];
  if (mods.buffs.length > 0)
    pips.push({ key: "buffs", glyph: `▲${mods.buffs.length}`, color: "#7fd89a",
                title: `BUFFS\n${mods.buffs.join("\n")}` });
  if (isBloodfire(card))
    pips.push({ key: "bloodfire", glyph: "🩸", color: "#ff5a3c",
                title: "BLOODFIRE — bleeding AND burning. Blood-fire payoff cards hit this target harder." });
  // Ahead of the statuses: BLOCK and REFLECT change how you should attack this
  // card, which is the decision being made while looking at the board.
  for (const g of granted) {
    const style = KEYWORD_STYLE[g.kw];
    if (!style) continue;
    pips.push({
      key: `granted-${g.kw}`,
      glyph: `${style.glyph}${g.rounds ?? `×${g.charges}`}`,
      color: style.color,
      title: `${g.label} (granted, not printed)`,
      // The only pips carrying a trailing number, so they cannot use the fixed
      // 13px square the others share — it clips the digit.
      cls: "timed",
    });
  }
  // A BLIND that cannot cost this card anything. Blazing Sun and Totem Spirit
  // do not CURE the status — they ignore it — so the pip stays, looking exactly
  // like the one on a card that is about to whiff. Reported as the spell being
  // broken, which is the right read of an unmarked pip. It is struck through
  // and says why instead.
  const missProof = fieldFlag(game, card, "neverMiss") || hasTotemSpirit(game, card);
  for (const s of card.statuses) {
    const st = STATUS_STYLE[s.kind];
    const moot = missProof && s.kind === "BLIND";
    pips.push({
      key: s.kind,
      glyph: st.glyph,
      color: st.color,
      cls: moot ? "pip-moot" : undefined,
      title: `${s.kind}${s.power ? ` ${s.power}` : ""}${s.source ? ` from ${s.source}` : ""} — ${s.duration} round(s)`
        + (moot ? " · ignored: this card cannot miss right now" : ""),
    });
  }
  if (mods.debuffs.length > 0)
    pips.push({ key: "debuffs", glyph: `▼${mods.debuffs.length}`, color: "#ff4d4d",
                title: `DEBUFFS\n${mods.debuffs.join("\n")}` });
  const showAuto = mine && human && card.autoMode !== "manual";
  const shownPips = pips.slice(0, 2);
  const morePips = pips.length - shownPips.length;

  // The HP bar's full width is max HP PLUS shields, so the grey head is
  // proportional to the damage it will actually absorb — shields are spent
  // first, which is why they are the head and not a separate meter.
  const maxHp = effectiveMaxHp(game, card);
  const shields = card.curShields;
  const barTotal = Math.max(1, maxHp + shields);
  const shPct = (shields / barTotal) * 100;
  const hpPct = (Math.max(0, card.curHp) / barTotal) * 100;
  const hits = effectiveBasicHits(card);
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
      data-el={def.element}
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
      {zapFx > 0 && (
        <span key={`zap${zapFx}`} className="fx-para">PARALYZED</span>
      )}
      {trueFx > 0 && (
        <span key={`true${trueFx}`} className="fx-true">STRIKES TRUE</span>
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
      {/* Name owns the entire top edge — no cost gem beside it. The cost is
          already paid by the time a card stands here; on the board it was only
          buying the name's first 17px, which is what forced "Rep…". */}
      <div className="tk-name">{def.name}</div>
      {/* Statuses as a left column, two deep, then a count. A wrapping strip
          across the middle of the art could grow to five chips and hide the
          thing you are looking at. */}
      {shownPips.length > 0 && (
        <div className="tk-pips">
          {shownPips.map((p) => (
            <span key={p.key} className={`tk-pip ${p.cls ?? ""}`} style={{ borderColor: p.color, color: p.color }} title={p.title}>
              {p.glyph}
            </span>
          ))}
          {morePips > 0 && (
            <span className="tk-pip tk-pip-more" title={pips.slice(2).map((p) => p.title).join("\n\n")}>
              +{morePips}
            </span>
          )}
        </div>
      )}
      {/* Keywords — what the card always is — mirrored down the right edge,
          with the auto marker as the column's last item. It is placed IN the
          column rather than pinned to a corner because a corner is a promise
          about height: at 87px an absolutely-placed letter clears the keywords
          above it and the stat row below, and at 55px (a 5x5 phone tile today,
          a landscape tile always) it lands on top of both. In the column it
          cannot collide with anything by construction. */}
      {(kwPips.length > 0 || showAuto) && (
        <div className="tk-pips tk-pips-kw">
          {kwPips.map(({ k, style }) => (
            <span key={k} className="tk-pip" style={{ borderColor: style.color, color: style.color }} title={k}>
              {style.glyph}
            </span>
          ))}
          {showAuto && (
            <span
              className={`tk-pip auto-tag ${card.autoMode}`}
              title={`On ${card.autoMode} auto — change it in the card panel`}
            >
              {AUTO_LABEL[card.autoMode]}
            </span>
          )}
        </div>
      )}
      {/* Three numerals, no icons. Colour IS the encoding — red damage, green
          HP, blue speed — which is what the canonical stat colours were for,
          and each icon cost about 8px of a row that has roughly 40 to spend.
          Shields left the row entirely: they are the bar's grey head now. */}
      <div className="tk-stats">
        <span
          className="st-dmg"
          title={`Damage${hits > 1 ? ` ×${hits} hits` : ""} (printed ${def.dmg}/hit; live value includes Mid-row control and statuses)`}
        >
          {effectiveDmg(game, card)}{hits > 1 && <span className="atk-x">×{hits}</span>}
        </span>
        <span
          className={`st-hp ${hpFlash === "down" ? "hp-hit" : hpFlash === "up" ? "hp-heal" : ""}`}
          title={`HP ${card.curHp} of ${maxHp}${shields > 0 ? ` · ${shields} shield${shields > 1 ? "s" : ""}` : ""}`}
        >
          {card.curHp}
        </span>
        <span
          className={`st-sp ${canMoveNow ? "can-move" : ""}`}
          title={canMoveNow ? "Can move this turn — click the card, then a green slot" : "Speed (queue order + move reach)"}
        >
          {effectiveSp(game, card)}
        </span>
      </div>
      {/* The bar carries the ratio the "/max" text used to, and carries it
          better: the row's width no longer changes the moment a card is
          wounded, which is what broke the stat row's layout. Its full width is
          max HP PLUS shields, so the grey head is proportional to the damage it
          will really absorb — shields are spent first, so they are the head. */}
      <div
        className="tk-bar"
        title={`${card.curHp}/${maxHp} HP${shields > 0 ? ` + ${shields} shield${shields > 1 ? "s" : ""}` : ""}`}
      >
        {shields > 0 && <span className="tk-bar-sh" style={{ width: `${shPct}%` }} />}
        <span className="tk-bar-hp" style={{ width: `${hpPct}%` }} />
      </div>
    </div>
  );
}
