import type { Element, GameState, PlayerId } from "../engine";
import { MatchReport } from "./MatchReport";
import { EL_COLOR, EL_ICON } from "./shared";

/** The fight already lined up behind this one.
 *
 *  Streak and Gauntlet deal their own opponents, so by the time you read
 *  VICTORY the next seat is filled — and the ask was to be shown it and choose,
 *  rather than be dropped back into a lobby to rediscover it. Everything here
 *  is a description of a match that exists: the deck, the rung, what a win
 *  pays. `onGo` starts it; `onNewGame` walks away with the mode's progress
 *  intact, which is the whole reason leaving is safe now. */
export interface NextUp {
  /** "SEAT 3 OF 4", "STREAK · 5 IN A ROW" — where this sits in the run. */
  flag: string;
  /** The opponent's deck name. */
  label: string;
  /** One line: rung, pay, and what a loss costs. */
  sub: string;
  /** The elements it fields, for a read of the matchup before agreeing to it. */
  elements?: Element[];
  goLabel: string;
  leaveLabel: string;
  onGo: () => void;
}

export function WinScreen(props: {
  game: GameState;
  /** The VIEWER's seat. Was assumed to be P1, which is right for vs-AI and a
   *  fair convention in hot-seat (one screen, two players) — but wrong online,
   *  where the guest sits in P2 and was shown VICTORY for a match it had just
   *  lost. Everything below reads relative to this. */
  me: PlayerId;
  onNewGame: () => void;
  /** Run the same two decks back. Absent when there is nothing to rematch —
   *  no remembered setup, or a story battle, which resolves its own way. */
  onRematch?: () => void;
  /** PvP handshake state. Both sides must ask before the host re-deals, so the
   *  button has to say which half is outstanding. */
  rematch?: { mine: boolean; theirs: boolean; online: boolean };
  /** Present only in a mode that deals its own opponents. */
  next?: NextUp;
  /** Shards this match just paid, when it paid any. Shown because a currency
   *  that arrives silently is a currency the player does not know they have —
   *  online pays on a LOSS too, and that is precisely the case nobody would
   *  think to go and check their balance after. */
  earned?: number;
}) {
  const { game, me } = props;
  const win = game.win;
  if (!win) return null;
  const youWon = win.winner === me;
  const drawn = win.winner === null; // timeout with nothing to separate the sides

  const r = props.rematch;
  const waiting = !!r?.online && r.mine && !r.theirs;
  const invited = !!r?.online && !r.mine && r.theirs;
  const rematchLabel = waiting
    ? "Waiting for opponent…"
    : invited
      ? "They want a rematch — accept"
      : "Rematch";

  return (
    <div className="overlay on-top">
      <div className="modal">
        <div className={`win-title ${drawn ? "" : youWon ? "win" : "lose"}`}>
          {drawn ? "DRAW" : youWon ? "VICTORY" : "DEFEAT"}
        </div>
        <p>
          {win.by === "surrender" ? (
            win.winner === me
              ? <>The opponent surrendered on round {game.round}.</>
              : <>You surrendered the match on round {game.round}.</>
          ) : drawn ? (
            <>
              Time ran out on round {game.round} with{" "}
              <b style={{ color: "var(--ink)" }}>nothing to separate you</b>.
            </>
          ) : win.by === "timeout" ? (
            <>
              Time ran out on round {game.round}.{" "}
              {youWon ? "You take it" : "The opponent takes it"} on{" "}
              <b style={{ color: "var(--ink)" }}>the board</b> — captures first, then cards
              standing, then HP.
            </>
          ) : (
            <>
              {youWon ? "You" : "The opponent"} won by{" "}
              <b style={{ color: "var(--ink)" }}>
                {win.by === "capture" ? "capturing all 4 Home slots" : "elimination"}
              </b>{" "}
              on round {game.round}.
            </>
          )}
        </p>

        {!!props.earned && (
          <div className="win-earned">
            +{props.earned}<i className="shard" aria-hidden="true" />
            <span>{youWon ? "for the win" : "for the match"}</span>
          </div>
        )}

        <MatchReport game={game} me={me} />

        {/* WHAT IS NEXT, before you have to leave the screen to find out. A
            mode that picks your opponent owes you a look at it. */}
        {props.next && (
          <div className="win-next">
            <span className="wn-flag">{props.next.flag}</span>
            <div className="wn-row">
              <b className="wn-name">{props.next.label}</b>
              {!!props.next.elements?.length && (
                <span className="wn-els">
                  {props.next.elements.map((el) => (
                    <img
                      key={el}
                      src={EL_ICON[el]}
                      alt={el}
                      title={el}
                      style={{ borderColor: EL_COLOR[el] }}
                    />
                  ))}
                </span>
              )}
            </div>
            <span className="wn-sub">{props.next.sub}</span>
          </div>
        )}

        <div className="win-acts">
          {props.next && (
            <button className="lockin glow" onClick={props.next.onGo}>
              {props.next.goLabel}
            </button>
          )}
          {/* Rematch runs the SAME two decks back, which is the one thing a
              streak is not allowed to do — so it stands down while a dealt
              opponent is waiting. */}
          {props.onRematch && !props.next && (
            <button
              className={`lockin ${invited ? "glow" : ""}`}
              onClick={props.onRematch}
              disabled={waiting}
            >
              {rematchLabel}
            </button>
          )}
          <button
            className={props.onRematch || props.next ? "ghost" : "lockin"}
            onClick={props.onNewGame}
          >
            {props.next ? props.next.leaveLabel : r?.online ? "Leave" : "New Match"}
          </button>
        </div>
      </div>
    </div>
  );
}
