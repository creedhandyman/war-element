/** THE PICK SCREEN — three warbands, then a spellbook.
 *
 *  Two stages behind one screen, because they are one act: you choose six
 *  groups of three and then fill the book those cards want. The header counts
 *  both down together, so a drafter always knows how many decisions are left
 *  rather than being surprised by a second phase.
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
  cardsComplete, draftComplete, draftSize, draftSpellCap, picksLeft, type DraftRun,
} from "../data/draft";

const spellArt = (id: string) => `/spells/${id}.webp`;

export function DraftScreen(props: {
  run: DraftRun;
  /** The label of one of `run.offer`. All three of its cards join the deck. */
  onPickGroup: (label: string) => void;
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
  const takeSpell = (id: string) => { setDetailId(null); props.onPickSpell(id); };
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
            {!done && <div className="dr-left">{left} pick{left === 1 ? "" : "s"} to go</div>}
          </div>
          <button className="ghost" onClick={props.onExit}>Leave</button>
        </div>

        {onCards && (
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
                    {g.cards.map((id) => {
                      const d = getDef(id);
                      const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
                      return (
                        <div key={id} className="deck-thumb carded db-card dr-card">
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
                              onClick={(e) => { e.stopPropagation(); setDetailId(id); }}
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
                    })}
                  </div>
                </div>
              ))}
            </div>
            <DeckStats stats={stats} compact />
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
            <DeckStats stats={stats} />
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
