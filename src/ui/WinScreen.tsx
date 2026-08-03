import type { GameState } from "../engine";
import { MatchReport } from "./MatchReport";

export function WinScreen(props: { game: GameState; onNewGame: () => void }) {
  const { game } = props;
  const win = game.win;
  if (!win) return null;
  const youWon = win.winner === "P1";
  const drawn = win.winner === null; // timeout with nothing to separate the sides

  return (
    <div className="overlay on-top">
      <div className="modal">
        <div className={`win-title ${drawn ? "" : youWon ? "win" : "lose"}`}>
          {drawn ? "DRAW" : youWon ? "VICTORY" : "DEFEAT"}
        </div>
        <p>
          {win.by === "surrender" ? (
            <>You surrendered the match on round {game.round}.</>
          ) : drawn ? (
            <>
              Time ran out on round {game.round} with{" "}
              <b style={{ color: "var(--ink)" }}>nothing to separate you</b>.
            </>
          ) : win.by === "timeout" ? (
            <>
              Time ran out on round {game.round}.{" "}
              {win.winner === "P1" ? "You take it" : "The opponent takes it"} on{" "}
              <b style={{ color: "var(--ink)" }}>the board</b> — captures first, then cards
              standing, then HP.
            </>
          ) : (
            <>
              {win.winner === "P1" ? "You" : "The opponent"} won by{" "}
              <b style={{ color: "var(--ink)" }}>
                {win.by === "capture" ? "capturing all 4 Home slots" : "elimination"}
              </b>{" "}
              on round {game.round}.
            </>
          )}
        </p>

        <MatchReport game={game} />

        <button className="lockin" onClick={props.onNewGame}>
          New Match
        </button>
      </div>
    </div>
  );
}
