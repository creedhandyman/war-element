import type { GameState } from "../engine";

const PHASES = ["draw", "resource", "prep", "battle", "cleanup"] as const;

export function PhaseRibbon(props: { game: GameState }) {
  const { game } = props;
  const statusText = (() => {
    if (game.phase === "mulligan") return "Mulligan — choose cards to return";
    if (game.phase === "prep")
      return game.prep?.priority === "P1"
        ? "Your prep — you have priority"
        : "Opponent has priority…";
    if (game.phase === "battle")
      return game.battle?.awaitingInput
        ? "Your card is up — choose its action"
        : "Resolving the Speed Queue…";
    if (game.phase === "gameover") return "Match over";
    return "Resolving…";
  })();
  const priorityYou = game.prep?.priority === "P1";
  return (
    <div className="phase-ribbon">
      <span className="roundchip">ROUND <b>{Math.max(1, game.round)}</b></span>
      <div className="phase-pills">
        {PHASES.map((p) => (
          <div key={p} className={`phase ${game.phase === p ? "active" : ""}`}>
            {p}
          </div>
        ))}
      </div>
      {game.phase === "prep" ? (
        <span className="priority-chip">
          PRIORITY <span className={`pri-dot ${priorityYou ? "you" : "opp"}`} />
          <b>{priorityYou ? "YOU" : "OPP"}</b>
        </span>
      ) : (
        <div className="waiting">
          <span className="dot-pulse" />
          <span>{statusText}</span>
        </div>
      )}
    </div>
  );
}
