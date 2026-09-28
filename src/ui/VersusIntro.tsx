/** The PvP versus screen — a beat between "connected" and "play" that shows
 *  what you are actually up against.
 *
 *  Online is the one mode where you have never seen the opposing deck. The
 *  Arena's versus card names both decks because YOU picked both; here the
 *  opponent is a stranger, the match previously opened straight into a mulligan,
 *  and the first thing you learned about their list was whatever walked onto the
 *  board in round two.
 *
 *  Built on `DeckSeat`, the Arena's own seat card, so this is the same object
 *  the player already knows — finisher art bleeding in from the right, the
 *  viewer-relative blue/red rim, the flag, the deck name, the element chips.
 *  Passing no `onChange` renders it as a locked panel rather than a dead button,
 *  which is exactly what a reveal wants. Under each seat sits the detail the
 *  Arena card has no room for: size, average cost, and the top of the curve —
 *  the cards this deck is built around and the ones worth bracing for.
 *
 *  THE CARD LISTS ARE DERIVED FROM THE GAME STATE — `deck` plus `hand`, which at
 *  deal time is the whole list — rather than from the deck ids each client
 *  happens to hold. The guest never receives the host's deck id, only the dealt
 *  state, so reading ids would have shown each player a different screen. The
 *  NAMES are the one thing the state cannot carry, so they ride along with it as
 *  `StateMeta` and the host relays both.
 */
import { useEffect, useRef, useState } from "react";
import { getDef } from "../data/cards";
import { voidBossElements } from "../data/void-tower";
import type { CardInstance, GameState, PlayerId } from "../engine";
import { effectiveDmg, effectiveMaxHp, seatsOf } from "../engine";
import { DeckSeat } from "./DeckPickerSheet";
import { cardArtSrc, suitFor } from "./shared";

/** How long the screen holds before the match begins. Short on purpose — this
 *  is a flourish in front of a fight someone is waiting to play, and every
 *  second here is a second the other player is staring at the same thing. */
const HOLD_MS = 4200;

/** A seat's whole list: what is left in the deck plus what was just dealt. */
const readSide = (state: GameState, p: PlayerId): string[] =>
  [...state.players[p].deck, ...state.players[p].hand.map((h) => h.defId)];

/** The BOSS standing on a seat's side at the deal, if there is one.
 *
 *  A Void Tower boss is seated straight onto the board at setup, OUTSIDE the
 *  deck — so `readSide` never sees it. This screen named the fight "Rotroot"
 *  and then wore Zombination's face and listed four Zombinations as the top of
 *  the curve: the one card the whole fight is about was the one card missing
 *  from it. The Quick match seat already faced itself with the boss; this is
 *  the same answer for the screen after it.
 *
 *  The dearest boss-flagged card, so a boss's own wall (cost 0) can never be
 *  mistaken for it, and never a TAMED one — that is a boss fighting for the
 *  player, not the opponent this seat is introducing. */
const bossOn = (state: GameState, p: PlayerId): CardInstance | null => {
  let best: CardInstance | null = null;
  for (const c of Object.values(state.cards)) {
    if (c.owner !== p || !c.pos || c.tamed || !getDef(c.defId).boss) continue;
    if (!best || getDef(c.defId).cost > getDef(best.defId).cost) best = c;
  }
  return best;
};

function Detail(props: { cards: string[]; boss?: { state: GameState; inst: CardInstance } | null }) {
  const { cards, boss } = props;
  const avg = cards.length ? cards.reduce((s, id) => s + getDef(id).cost, 0) / cards.length : 0;
  // The top of the curve, dearest first — one line shorter when the boss heads
  // the list, so the panel keeps its height.
  const top = [...cards].sort((a, b) => getDef(b).cost - getDef(a).cost).slice(0, boss ? 3 : 4);
  const bossDef = boss ? getDef(boss.inst.defId) : null;
  return (
    <div className="pvi-detail">
      <div className="pvi-meta">
        <span><b>{cards.length}</b> {boss ? "in the brood" : "cards"}</span>
        <span>avg cost <b>{avg.toFixed(1)}</b></span>
      </div>
      <div className="pvi-top">
        {boss && bossDef && (
          /* Its LIVE numbers, read off the instance: an enraged trial is the
             same card scaled up, and the card's printed line would undersell
             exactly the fight that was made harder. */
          <span className="pvi-card boss" data-el={bossDef.element}>
            <b>BOSS</b>
            <em>{bossDef.name}</em>
            <i>
              {effectiveDmg(boss.state, boss.inst)}×{bossDef.hits} · {effectiveMaxHp(boss.state, boss.inst)} HP
              {boss.inst.curShields ? ` · ${boss.inst.curShields} shields` : ""}
            </i>
          </span>
        )}
        {top.map((id, i) => {
          const d = getDef(id);
          return (
            <span className="pvi-card" key={`${id}-${i}`} data-el={d.element}>
              <b>{d.cost}</b>
              <em>{d.name}</em>
              <i>{d.dmg}×{d.hits} · {d.hp} HP</i>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function VersusIntro(props: {
  game: GameState;
  me: PlayerId;
  /** Both seats' deck names, relayed by the host. Absent only if the opening
   *  message was missed entirely, hence the fallbacks. */
  names: Partial<Record<PlayerId, string>> | null;
  onDone: () => void;
}) {
  const { game, me, names, onDone } = props;
  // EVERY opponent, not "the" opponent. A free-for-all has up to three, and
  // showing one of them picked arbitrarily is worse than showing none — it
  // reads as a 1v1 against whichever seat happened to sort first.
  //
  // Read ONCE at mount, so a player mulliganing while this is still up cannot
  // re-shuffle the panels under everyone.
  const [mine] = useState(() => readSide(game, me));
  const [foes] = useState(() =>
    seatsOf(game).filter((p) => p !== me).map((p) => ({ seat: p, cards: readSide(game, p), boss: bossOn(game, p) })));
  // Two seats keep the big side-by-side reveal they have always had; three or
  // four stack the opponents into a narrower column each, because four full
  // panels do not fit and shrinking all of them would cost the 1v1 nothing to
  // gain and everything to look at.
  const many = foes.length > 1;

  // The dismiss timer is armed ONCE, on mount.
  //
  // Depending on `onDone` looked harmless and was not: the parent passes a fresh
  // arrow every render, so the effect tore down and re-armed the timer on each
  // one — and this sits over a live PvP match that re-renders on every incoming
  // state AND on a 2.5s heartbeat. The 4.2s timeout never survived long enough
  // to fire, so the screen stayed up until the player tapped it. Caught on the
  // deployed build; nothing in tsc or the suite can see it.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="overlay on-top pvi-wrap" onClick={onDone}>
      <div className={`pvi${many ? " pvi-many" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="pvi-col">
          {/* Named by SUIT as well as seat, so the identity you learn here is the
              one you read off the board a minute later — and the suit is dealt
              per match now, so it is worth reading. */}
          <DeckSeat
            side="mine"
            flag={`YOU · ${suitFor(game.seatSuits, me).glyph} ${me}`}
            label={names?.[me] ?? "Your squad"}
            cards={mine}
          />
          <Detail cards={mine} />
        </div>

        <div className="pvi-mid">
          <span className="pvi-vs">{many ? `VS ${foes.length}` : "VS"}</span>
          <span className="pvi-bar" aria-hidden="true"><i /></span>
          <button className="pvi-skip" onClick={onDone}>tap to skip</button>
        </div>

        <div className="pvi-foes">
          {foes.map((f) => (
            <div className="pvi-col" key={f.seat}>
              <DeckSeat
                side="foe"
                flag={`${many ? "" : f.boss ? "BOSS · " : "OPPONENT · "}${suitFor(game.seatSuits, f.seat).glyph} ${f.seat}`}
                label={names?.[f.seat] ?? (f.boss ? getDef(f.boss.defId).name : "Their deck")}
                cards={f.cards}
                /* The boss's face and the boss's two elements — the same pair
                   the Quick match seat shows — rather than the brood's. */
                artOverride={f.boss ? cardArtSrc(getDef(f.boss.defId)) : undefined}
                elements={f.boss ? voidBossElements(f.boss.defId) : undefined}
              />
              {/* THE TELL. The opponent's suit is dealt fresh each match and
                  decides how its AI plays, so saying which style you are about
                  to meet is the whole point of dealing it — a glyph nobody can
                  read is the decoration this replaced. Shown only for an AI
                  seat: a human opponent has a suit for identity, not a
                  personality, and labelling them "Attack" would be a lie. */}
              {!(game.humans ?? ["P1"]).includes(f.seat) && (
                <div className={`pvi-style suit-${suitFor(game.seatSuits, f.seat).key}`}>
                  <b>{suitFor(game.seatSuits, f.seat).name}</b>
                  <span>{suitFor(game.seatSuits, f.seat).blurb}</span>
                </div>
              )}
              {/* The curve detail is what does not fit four across. In a
                  free-for-all the seat and the deck name are what you need to
                  tell three strangers apart; the lists are on the board in a
                  minute either way. */}
              {!many && <Detail cards={f.cards} boss={f.boss ? { state: game, inst: f.boss } : null} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
