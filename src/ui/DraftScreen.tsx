/** THE PICK SCREEN — three cards, take one, eighteen times.
 *
 *  Phase 2 of draft, and deliberately DUMB: it owns no run state, reads no
 *  save, and knows nothing about opponents or rewards. The run comes in as a
 *  prop and every pick goes straight back out through `onPick`, so the same
 *  screen serves whatever phase 3 decides to wire it into — and so the pick
 *  logic stays testable as pure functions rather than through a component this
 *  repo has no DOM environment to render.
 *
 *  IT REUSES THE BUILDER'S TILE (`deck-thumb carded db-card`) rather than
 *  inventing a fourth card style. That tile already solves art, the cost-on-
 *  element sigil, the rarity strip, the stat row and — the one that matters
 *  here — a separate ⓘ that opens the full card without triggering the body.
 *  Drafting a card you cannot read is the worst version of this screen, and on
 *  a phone the frequent action (pick) needs the big target while the rare one
 *  (read it) gets a corner. The builder learned that; this inherits it.
 */

import { useMemo, useState } from "react";
import { getDef } from "../engine";
import { composition, DeckStats } from "./DeckStats";
import { CardView } from "./CardView";
import { SpIcon } from "./icons";
import { EL_COLOR, EL_ICON, RARITY_STYLE } from "./shared";
import { draftComplete, draftSize, type DraftRun } from "../data/draft";

export function DraftScreen(props: {
  run: DraftRun;
  /** One of `run.offer`. The parent owns the run and rolls the next offer. */
  onPick: (id: string) => void;
  /** Leave the draft. The parent decides whether that abandons it. */
  onExit: () => void;
  /** Fired when the last pick lands, with the finished deck. */
  onFinish?: (deck: string[]) => void;
}) {
  const { run } = props;
  const [detailId, setDetailId] = useState<string | null>(null);
  const size = draftSize(run);
  const done = draftComplete(run);
  const stats = useMemo(() => composition(run.picks), [run.picks]);
  const detail = detailId ? getDef(detailId) : null;

  const take = (id: string) => {
    setDetailId(null); // never leave the reader open over the next offer
    props.onPick(id);
    if (run.picks.length + 1 >= size) props.onFinish?.([...run.picks, id]);
  };

  return (
    <div className="overlay on-top">
      <div className="modal draft-screen">
        <div className="dr-head">
          <div>
            <div className="dr-kind">Draft</div>
            {/* The count is the whole progress bar. A drafter needs to know how
                many decisions are left far more than they need a percentage. */}
            <h1>{done ? "Squad complete" : `Pick ${run.picks.length + 1} of ${size}`}</h1>
          </div>
          <button className="ghost" onClick={props.onExit}>Leave</button>
        </div>

        {!done && (
          <>
            <div className="dr-offer">
              {run.offer.map((id) => {
                const d = getDef(id);
                const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
                return (
                  <div
                    key={id}
                    className="deck-thumb carded db-card dr-card"
                    role="button"
                    tabIndex={0}
                    title={`${d.name} — tap to take`}
                    onClick={() => take(id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); take(id); }
                    }}
                  >
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
            {/* WHY THE READOUT IS ON THIS SCREEN AND NOT A TAB AWAY: the offer
                is steered toward a curve, and a drafter who cannot see their
                own curve is being steered by something invisible. The same
                component the builder and the story collection use, so the three
                cannot drift apart. */}
            <DeckStats stats={stats} compact />
          </>
        )}

        {done && (
          <div className="dr-done">
            <p>Eighteen cards, none of them yours to keep. Take them into the fight.</p>
            <DeckStats stats={stats} />
          </div>
        )}

        {detail && (
          <CardView
            mode="browse"
            def={detail}
            onClose={() => setDetailId(null)}
            action={{
              label: "Take this card",
              primary: true,
              onClick: () => take(detail.id),
            }}
          />
        )}
      </div>
    </div>
  );
}
