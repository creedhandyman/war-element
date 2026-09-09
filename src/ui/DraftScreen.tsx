/** THE PICK SCREEN — warbands, then single cards, then a spellbook.
 *
 *  Three stages behind one screen, because they are one act: you choose the
 *  warbands that decide what the squad IS, then six cards one at a time to fix
 *  what it is missing, then the book those cards want. The header counts all
 *  three down together, so a drafter always knows how many decisions are left
 *  rather than being surprised by a phase they did not know was coming.
 *
 *  ONE CARD RENDERER for both card stages (`DraftCard`). The trio inside a
 *  banner and the five on a single table are the same object in two containers,
 *  and the first draft of this screen had the forty-line thumbnail written out
 *  twice — which is two places for the ⓘ button to stop opening the reader.
 *
 *  Still DUMB, like every other screen here: the run arrives as a prop, every
 *  choice leaves through a callback, and it owns no state but which card the
 *  reader is open on. The pick logic stays pure and testable in draft.ts, which
 *  matters more than usual in a repo with no DOM to render this in.
 */

import { useMemo, useState } from "react";
import { getDef, getSpell } from "../engine";
import { composition, DeckStats } from "./DeckStats";
import { CardView } from "./CardView";
import { SpIcon } from "./icons";
import { EL_COLOR, EL_ICON, RARITY_STYLE } from "./shared";
import {
  cardsComplete, draftComplete, draftSize, draftSpellCap, inGroupPhase, picksLeft,
  type DraftRun,
} from "../data/draft";

const spellArt = (id: string) => `/spells/${id}.webp`;

/** One card on a table — inside a banner's trio, or on its own in the single
 *  half. `onInfo` opens the reader; the card itself is not the button, because
 *  in the single half the card IS the pick and a stray tap on the ⓘ must not
 *  spend it. */
function DraftCard(props: { id: string; onInfo: (id: string) => void }) {
  const d = getDef(props.id);
  const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
  return (
    <div className="deck-thumb carded db-card dr-card">
      <img
        className="card-art"
        src={`/cards/${d.art ?? d.id}.webp`}
        alt=""
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
      <div className="dt-top">
        <span
          className="dt-cost"
          title={`${d.element} · cost ${d.cost}`}
          style={{ borderColor: EL_COLOR[d.element], backgroundImage: `url(${EL_ICON[d.element]})` }}
        >
          <b>{d.cost}</b>
        </span>
        <button
          className="dt-info"
          title={`${d.name} — see the card`}
          aria-label={`${d.name} — see the card`}
          onClick={(e) => { e.stopPropagation(); props.onInfo(props.id); }}
        >
          ⓘ
        </button>
      </div>
      {rar && (
        <span className="dt-rarity" style={{ color: rar.color, borderColor: rar.color }}>
          {rar.label}
        </span>
      )}
      <div className="dt-name">{d.name}</div>
      <div className="dt-stats">
        <span className="s-dmg">⚔<span className="atk-dmg">{d.dmg}</span>{d.hits > 1 ? <span className="atk-x"> ×{d.hits}</span> : ""}</span>
        <span className="s-hp">♥{d.hp}</span>
        <span className="s-sp"><SpIcon />{d.sp}</span>
      </div>
    </div>
  );
}

export function DraftScreen(props: {
  run: DraftRun;
  /** The label of one of `run.offer`. All three of its cards join the deck. */
  onPickGroup: (label: string) => void;
  /** One of `run.cardOffer` — the single half. Exactly that card joins. */
  onPickCard: (id: string) => void;
  /** One of `run.spellOffer`. */
  onPickSpell: (id: string) => void;
  onExit: () => void;
}) {
  const { run } = props;
  const [detailId, setDetailId] = useState<string | null>(null);
  const stats = useMemo(() => composition(run.picks), [run.picks]);
  const detail = detailId ? getDef(detailId) : null;
  const onCards = !cardsComplete(run);
  /** Take a group, and shut the reader first.
   *
   *  Tapping a card's ⓘ and then taking a banner would otherwise leave the
   *  reader open over three cards it was not opened from — the offer changes
   *  underneath it. Same for a spell. */
  const takeGroup = (label: string) => { setDetailId(null); props.onPickGroup(label); };
  const takeCard = (id: string) => { setDetailId(null); props.onPickCard(id); };
  const takeSpell = (id: string) => { setDetailId(null); props.onPickSpell(id); };
  /** Which card stage is up. Asked of the run rather than counted here — the
   *  boundary is `groupCards`'s to own, and a screen that worked it out for
   *  itself is a second copy of the format. */
  const onGroups = onCards && inGroupPhase(run);
  const done = draftComplete(run);
  const left = picksLeft(run);

  return (
    <div className="overlay on-top">
      <div className="modal draft-screen">
        <div className="dr-head">
          <div>
            <div className="dr-kind">Draft</div>
            <h1>
              {done ? "Squad complete"
                : onCards ? `${run.picks.length} of ${draftSize(run)} cards`
                  : `Spell ${(run.spells?.length ?? 0) + 1} of ${draftSpellCap(run)}`}
            </h1>
            {/* ONE COUNTDOWN ACROSS BOTH STAGES. A drafter who thinks they are
                two picks from finished and then meets a spellbook has been
                misled by the screen, not surprised by the format. */}
            {!done && (
              <div className="dr-left">
                {left} pick{left === 1 ? "" : "s"} to go
                {/* WHICH KIND of pick, because they are not the same decision
                    and the one that is about to change is worth naming before
                    it does. */}
                {onCards && (onGroups ? " · warbands" : " · one at a time")}
              </div>
            )}
          </div>
          <button className="ghost" onClick={props.onExit}>Leave</button>
        </div>

        {onGroups && (
          <>
            <div className="dr-groups">
              {run.offer.map((g) => (
                <div key={g.label} className="dr-group">
                  <button
                    className="dr-banner"
                    title={`Take all three ${g.label} cards`}
                    onClick={() => takeGroup(g.label)}
                  >
                    <span className="dr-banner-name">{g.label}</span>
                    {/* Tribe or element, said out loud. They are drawn the same
                        way and they are not the same thing — a quarter of the
                        set carries no tribe and forms element groups instead. */}
                    <span className="dr-banner-kind">{g.kind === "tribe" ? "tribe" : "element"}</span>
                  </button>
                  <div className="dr-trio">
                    {g.cards.map((id) => (
                      <DraftCard key={id} id={id} onInfo={setDetailId} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <DeckStats stats={stats} gaps />
          </>
        )}

        {onCards && !onGroups && (
          <>
            {/* THE LAST SIX, ONE AT A TIME. The whole of what this stage adds is
                that the card is the button: there is no banner over it and
                nothing else comes with it, so the decision is the card in front
                of you against the deck you have already built. The stats strip
                below is the same one the warbands had, and it is doing more work
                here — it is what tells you which hole you are filling. */}
            <div className="dr-singles">
              {(run.cardOffer ?? []).map((id) => (
                <button
                  key={id}
                  className="dr-single"
                  title={`Take ${getDef(id).name}`}
                  onClick={() => takeCard(id)}
                >
                  <DraftCard id={id} onInfo={setDetailId} />
                </button>
              ))}
            </div>
            <DeckStats stats={stats} gaps />
          </>
        )}

        {!onCards && !done && (
          <>
            {/* THE BOOK IS HALF OF WHAT A DECK DOES. It used to be derived from
                the finished deck's elements — the right default for a deck
                somebody built, and a decision taken away from a drafter. */}
            <div className="dr-spells">
              {(run.spellOffer ?? []).map((id) => {
                const sp = getSpell(id);
                return (
                  <button
                    key={id}
                    className="spellchip dr-spell"
                    data-el={sp.element}
                    title={`${sp.name} (cost ${sp.cost}) — ${sp.text}`}
                    onClick={() => takeSpell(id)}
                  >
                    <span className="spellchip-cost">{sp.cost}</span>
                    <span className="spellchip-art">
                      <img
                        src={spellArt(sp.id)}
                        alt=""
                        draggable={false}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </span>
                    <span className="spellchip-body">
                      <span className="spellchip-head">
                        <span className="spellchip-name">{sp.name}</span>
                      </span>
                      <span className="spellchip-text">{sp.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {(run.spells?.length ?? 0) > 0 && (
              <div className="dr-book">
                {run.spells!.map((id) => (
                  <span key={id} className="dr-book-spell" data-el={getSpell(id).element}>
                    {getSpell(id).cost} · {getSpell(id).name}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {done && (
          <div className="dr-done">
            <p>
              {draftSize(run)} cards and {run.spells?.length ?? 0} spells, none of them
              yours to keep. Take them into the fight.
            </p>
            <DeckStats stats={stats} gaps />
          </div>
        )}

        {detail && (
          <CardView
            mode="browse"
            def={detail}
            onClose={() => setDetailId(null)}
          />
        )}
      </div>
    </div>
  );
}
