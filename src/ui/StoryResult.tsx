/** Story Mode — the post-battle card.
 *
 *  On a WIN it has to answer two questions fast: what did I get, and why that
 *  much — hence the capture count is stated outright, since capture is what
 *  earns the rolls. On a LOSS it used to drop you straight back to the map with
 *  nothing at all, which told you neither what beat you nor how close it was.
 *
 *  Both endings now carry the match report. Story Mode is where a deck gets
 *  tested against a known formation, so the numbers are worth more here than
 *  anywhere else — it collapses by default so the recruit stays the headline.
 */
import { useState } from "react";
import type { GameState } from "../engine";
import { getDef } from "../data/cards";
import { isGate, type StoryNode } from "../data/story";
import { MatchReport, hasMatchReport } from "./MatchReport";

export function StoryResult(props: {
  node: StoryNode;
  game: GameState;
  won: string[];
  captured: number;
  firstClear: boolean;
  /** True when the whole roster was already owned — "unlucky" would be a lie. */
  exhausted: boolean;
  /** The node beat you. Nothing is recruited and nothing is cleared. */
  lost?: boolean;
  /** Card ids held in foil. A recruit can arrive shiny — `applyClear` rolls it
   *  the same way a pack does — and this screen was the one place that could
   *  hand you your first foil without ever saying so. */
  foils?: ReadonlySet<string>;
  onDone: () => void;
}) {
  const { node, game, won, captured, firstClear, lost } = props;
  const rolls = Math.max(1, captured);
  const [showReport, setShowReport] = useState(false);
  // A JSX element is always truthy, so ask the data — not the element — whether
  // there is a report, or the toggle appears above an empty panel.
  const hasReport = hasMatchReport(game);

  return (
    <div className="overlay on-top">
      <div className={`modal story-result ${showReport ? "wide" : ""}`}>
        <h1 className={lost ? "sr-lost" : undefined}>
          {lost ? `${node.name} held` : isGate(node) ? "Border crossed" : `${node.name} cleared`}
        </h1>

        {lost ? (
          <p>
            They kept the field on round {game.round}. Nothing is lost but the time — the
            node is unchanged and you can walk back in whenever you like.
          </p>
        ) : isGate(node) ? (
          <p>
            The patrol is broken. <b>{(node.opens ?? []).join(" and ").toUpperCase()}</b> is
            open, and this gate stays open behind you.
          </p>
        ) : (
          <p>
            {captured > 0
              ? <>You padlocked <b>{captured}</b> {captured === 1 ? "slot" : "slots"} — {rolls} recruit {rolls === 1 ? "roll" : "rolls"}.</>
              : <>Won by elimination — no slots padlocked, so one roll.</>}
          </p>
        )}

        {lost || isGate(node) ? null : won.length > 0 ? (
          <>
            <div className="sr-label">Recruited</div>
            <ul className="sr-list">
              {won.map((id) => {
                const d = getDef(id);
                return (
                  <li key={id} className={props.foils?.has(id) ? "sr-foil" : undefined}>
                    <span className="sr-name">
                      {props.foils?.has(id) && <i className="foil-tag inline" title="Foil">✦</i>}
                      {d.name}
                    </span>
                    <span className={`npr-rar r-${d.rarity ?? "rare"}`}>{d.rarity ?? "rare"}</span>
                    <span className="sr-stats">{d.cost}◆ · {d.dmg}{(d.hits ?? 1) > 1 ? `×${d.hits}` : ""} · {d.hp} hp</span>
                  </li>
                );
              })}
            </ul>
            {node.kind === "throne" && firstClear && (
              <p className="sr-note">Throne bosses are a guaranteed recruit on first clear.</p>
            )}
          </>
        ) : (
          <p className="sr-empty">
            {props.exhausted
              ? "You already own every card here — nothing left to recruit."
              : "Nothing joined this time. Every dry clear raises the odds here — come back."}
          </p>
        )}

        {hasReport && (
          <>
            <button
              className="sr-toggle"
              onClick={() => setShowReport((v) => !v)}
              aria-expanded={showReport}
            >
              {showReport ? "Hide match report" : "Match report"}
              <span className="sr-toggle-sub">· {game.round} rounds</span>
            </button>
            {showReport && (
              <MatchReport game={game} heading={lost ? "What happened" : "Match Report"} />
            )}
          </>
        )}

        <button className="lockin" onClick={props.onDone}>Back to the map</button>
      </div>
    </div>
  );
}
