/** One boss, up close — the screen the tower tile opens.
 *
 *  The tower is a wall of portraits and nothing else: you could see a boss and
 *  fight it, and there was no third thing you could do. Everything the game
 *  already knew about a boss — its lore, the lesson it teaches, what it fields,
 *  what its Special does and on what beat — lived only in the data or in the
 *  fight itself, which meant the only way to learn a boss was to lose to it.
 *
 *  This is where that goes, and it is also where TAMING lives, because taming
 *  is a fact about a specific boss and belongs on the boss's own page rather
 *  than in a menu somewhere else.
 *
 *  THREE STATES, and the screen says which one it is in before anything else:
 *    · not yet beaten   — fight it.
 *    · beaten, floor unfinished — refight it.
 *    · ENRAGED (its floor is cleared) — the taming trial. Harder, and winning
 *      brings it over to your side for three battles.
 *
 *  It owns no progression state. Everything is derived from the save the same
 *  way the tower derives it, so the two can never disagree.
 */
import { useState } from "react";
import { Check, Flame, Lock, Swords, X } from "lucide-react";
import type { StorySave } from "../data/story";
import type { GameEvent } from "../data/events";
import { getDef } from "../data/cards";
import { EL_COLOR } from "./shared";
import { VOID_TOWER_ROUNDS } from "../engine/types";
import { describeOwnPassives } from "./card-text";
import {
  ENRAGE_SCALE, TAME_SCALE, TAME_USES, type VoidBoss,
  bodyCap, bossDefeated, bossEnraged, summonBudget, tameUsesLeft, tamedRoster, tamedStats,
} from "../data/void-tower";

/** The scale multipliers as a percentage, for prose. */
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function BossDetail(props: {
  boss: VoidBoss;
  save: StorySave;
  /** The boss's own trial event, or null when it has none (never, in practice —
   *  one is generated per boss — but the tower checks, so this does too). */
  event: GameEvent | null;
  /** Is this boss's floor open? A locked boss can still be READ about; it just
   *  cannot be fought, which is the whole reason the page is worth opening on
   *  one. */
  open: boolean;
  /** JUST TAMED — the player has this second come back from beating it while
   *  enraged. The page opens on the reveal instead of on the fight, because
   *  the moment a boss changes sides is the moment worth showing, and the win
   *  screen has no idea which boss it was fighting. */
  justTamed?: boolean;
  onClose: () => void;
  onFight: (event: GameEvent, opts: { enraged: boolean; ally: string | null }) => void;
}) {
  const { boss, save } = props;
  const def = getDef(boss.cardId);
  const done = save.eventsDone ?? [];
  const beaten = bossDefeated(done, boss.cardId);
  const enraged = bossEnraged(done, boss.cardId);
  const myUses = tameUsesLeft(save.tamed, boss.cardId);
  // A tamed boss cannot be brought to a fight against ITSELF. It is standing
  // right there.
  const stable = tamedRoster(save.tamed).filter((t) => t.boss.cardId !== boss.cardId);
  const [ally, setAlly] = useState<string | null>(null);

  const tintA = EL_COLOR[boss.tribeElement];
  const tintB = EL_COLOR[boss.mechanicElement];
  const sp = def.special;
  const beat = def.roundTick?.fireSpecialEveryN ?? 0;

  return (
    <div className="overlay on-top bd-overlay">
      <div className="modal bd-modal" style={{ ["--tint" as string]: tintA, ["--tint2" as string]: tintB }}>
        {/* Sticky rail, not a floating corner button: this panel scrolls and has
            no backdrop-click dismiss, so an absolutely-placed ✕ scrolled away
            and stranded the reader on the lore. */}
        <div className="bd-closebar">
          <button className="bd-close" type="button" onClick={props.onClose} aria-label="Back to the tower">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* THE FACE, at the size the tower promised. The art fades into the
            page rather than ending on a line, so the text below reads as the
            same object rather than a caption under a picture. */}
        <div className="bd-hero">
          <img src={`/cards/${def.art ?? def.id}.webp`} alt="" className="bd-art" />
          <div className="bd-hero-fade" />
          <div className="bd-hero-text">
            <span className="bd-pair">
              <b style={{ color: tintA }}>{boss.tribeElement}</b>
              <i>/</i>
              <b style={{ color: tintB }}>{boss.mechanicElement}</b>
              <i>·</i>
              <span className="bd-tribe">{boss.tribe}</span>
            </span>
            <h1>{def.name}</h1>
            <span className="bd-floor">Floor {boss.floor}</span>
          </div>
          <span className={`bd-state ${enraged ? "rage" : beaten ? "down" : ""}`}>
            {!props.open
              ? <><Lock size={12} aria-hidden="true" />LOCKED</>
              : enraged
                ? <><Flame size={12} aria-hidden="true" />ENRAGED</>
                : beaten
                  ? <><Check size={12} aria-hidden="true" />CLEARED</>
                  : <><Swords size={12} aria-hidden="true" />UNBEATEN</>}
          </span>
        </div>

        {/* THE REVEAL. Shown above the lore, because it is the answer to the
            question the player is holding when this page opens. It states the
            body they actually get, computed by the same rounding the board
            uses — a preview that disagreed with the card on the table would be
            worse than no preview. */}
        {props.justTamed && (() => {
          const t = tamedStats(def);
          return (
            <div className="bd-tamed-reveal">
              <div className="bd-tamed-head">
                <Flame size={14} aria-hidden="true" />
                <b>TAMED</b>
              </div>
              <p>
                {def.name} fights for you in your next <b>{myUses || TAME_USES}</b>{" "}
                battle{(myUses || TAME_USES) === 1 ? "" : "s"}, at {pct(TAME_SCALE)} of
                everything it has — bring it from any boss's page.
              </p>
              {/* A stat the card does not have is left out entirely — Rotroot
                  has no shields, and a "SHLD 0 → 0" cell is a row of noise in
                  the middle of the payoff. */}
              <div className="bd-tamed-stats">
                {([
                  ["DMG", def.dmg, t.dmg],
                  ["HP", def.hp, t.hp],
                  ["SHLD", def.shields, t.shields],
                  ["SP", def.sp, t.sp],
                ] as [string, number, number][])
                  .filter(([, was]) => was > 0)
                  .map(([label, was, now]) => (
                    <span key={label}><i>{label}</i>{was}<em>→</em><b>{now}</b></span>
                  ))}
              </div>
              <p className="bd-tamed-foot">
                Its Special is scaled too — {sp ? sp.name : "everything it does"} included.
                These are its printed stats; on the board its element's aura still
                applies on top, so it can only be better than this.
              </p>
            </div>
          );
        })()}

        {/* Lore is authored per boss and already on the def — see cards.ts,
            which folds LORE onto every def at module load. */}
        {def.lore && <p className="bd-lore" data-el={def.element}>{def.lore}</p>}

        {enraged && !props.justTamed && (
          <div className="bd-rage">
            <b>It has not forgotten.</b> Clearing Floor {boss.floor} left every boss on it
            enraged — this one comes back at {pct(ENRAGE_SCALE)} of its old strength, Special
            included. Beat it like that and it fights <b>for you</b> in your next{" "}
            {TAME_USES} battles, at {pct(TAME_SCALE)} of everything it has.
            {myUses > 0 && <> You have <b>{myUses}</b> left on it — winning again refills to {TAME_USES}.</>}
          </div>
        )}

        {/* THE TIPS. Half authored, half derived — the authored line is the
            lesson the boss exists to teach, and the rest is what the fight is
            actually made of, which the player could otherwise only learn by
            losing to it. */}
        <div className="bd-tips">
          <p className="bd-puzzle">{boss.puzzle}</p>
          <ul>
            <li>
              <b>{def.name}</b> fields a {summonBudget(boss.floor)}-gold formation and a body
              built to Floor {boss.floor}'s cap of {bodyCap(boss.floor)}.
            </li>
            {sp && (
              <li>
                <b>{sp.name}</b>
                {beat > 0 && <> fires free every {beat} rounds — it is a clock, not a choice,
                  so it can be counted and planned around</>}. {sp.text}
              </li>
            )}
            <li>
              Slay it within <b>{VOID_TOWER_ROUNDS} rounds</b>. Home slots cannot be captured in
              here, so killing it is the only way through — and a wall of Fortress Gates stands
              in front of your home row for free.
            </li>
            {describeOwnPassives(def).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>

        {/* THE STABLE. Only rendered when there is something in it — an empty
            picker on a fresh save would be a permanent reminder of a feature
            the player cannot use yet. */}
        {props.open && stable.length > 0 && (
          <div className="bd-stable">
            <div className="bd-stable-head">
              Bring a tamed boss
              <span>{pct(TAME_SCALE)} strength · one per fight · spends a use even if you lose</span>
            </div>
            <div className="bd-stable-row">
              <button
                type="button"
                className={`bd-tame ${ally === null ? "on" : ""}`}
                onClick={() => setAlly(null)}
              >
                <span className="bd-tame-none">Alone</span>
              </button>
              {stable.map(({ boss: t, uses }) => {
                const tDef = getDef(t.cardId);
                return (
                  <button
                    key={t.cardId}
                    type="button"
                    className={`bd-tame ${ally === t.cardId ? "on" : ""}`}
                    onClick={() => setAlly(ally === t.cardId ? null : t.cardId)}
                    title={`${tDef.name} — ${uses} battle(s) left`}
                  >
                    <img src={`/cards/${tDef.art ?? tDef.id}.webp`} alt="" />
                    <span className="bd-tame-name">{tDef.name}</span>
                    <span className="bd-tame-uses">{uses}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          className={`lockin bd-fight ${enraged ? "rage" : ""}`}
          disabled={!props.open || !props.event}
          onClick={() => props.event && props.onFight(props.event, { enraged, ally })}
        >
          {!props.open
            ? `Clear Floor ${boss.floor - 1} to reach it`
            : enraged
              ? "Fight it enraged — tame it"
              : beaten ? "Refight" : "Fight"}
        </button>
      </div>
    </div>
  );
}
