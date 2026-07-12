import type { GameState } from "../engine";

export function WinScreen(props: { game: GameState; onNewGame: () => void }) {
  const win = props.game.win;
  if (!win) return null;
  const youWon = win.winner === "P1";
  return (
    <div className="overlay">
      <div className="modal">
        <div className={`win-title ${youWon ? "win" : "lose"}`}>
          {youWon ? "VICTORY" : "DEFEAT"}
        </div>
        <p>
          {win.by === "surrender" ? (
            <>
              You surrendered the match on round {props.game.round}.
            </>
          ) : (
            <>
              {win.winner === "P1" ? "You" : "The opponent"} won by{" "}
              <b style={{ color: "var(--ink)" }}>
                {win.by === "capture" ? "capturing all 4 Home slots" : "elimination"}
              </b>{" "}
              on round {props.game.round}.
            </>
          )}
        </p>
        <button className="lockin" onClick={props.onNewGame}>
          New Match
        </button>
      </div>
    </div>
  );
}
