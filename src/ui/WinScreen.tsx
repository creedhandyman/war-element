import type { GameState, PlayerId } from "../engine";
import { MatchReport } from "./MatchReport";

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

        <MatchReport game={game} me={me} />

        <div className="win-acts">
          {props.onRematch && (
            <button
              className={`lockin ${invited ? "glow" : ""}`}
              onClick={props.onRematch}
              disabled={waiting}
            >
              {rematchLabel}
            </button>
          )}
          <button className={props.onRematch ? "ghost" : "lockin"} onClick={props.onNewGame}>
            {r?.online ? "Leave" : "New Match"}
          </button>
        </div>
      </div>
    </div>
  );
}
