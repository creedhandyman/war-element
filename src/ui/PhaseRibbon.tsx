import type { GameState } from "../engine";
import { VOID_TOWER_ROUNDS } from "../engine/types";

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
      {/* Deployment runs at round 0, before the first round proper. Showing
          "ROUND 1" there would claim the match had started. */}
      {/* A Void Tower fight is on a fixed clock and running it out is a
          LOSS, so the chip counts down instead of up. A timer you cannot see is
          not a puzzle, it is an ambush; this is the only place the player looks
          for the round, so it is where the deadline belongs. Turns urgent on
          the last five. */}
      <span className={`roundchip${game.voidTower && !game.opening
        ? ` vt${VOID_TOWER_ROUNDS - game.round <= 5 ? " urgent" : ""}` : ""}`}>
        {game.opening
          ? <b>DEPLOY</b>
          : game.voidTower
            ? <>ROUND <b>{Math.max(1, game.round)}</b> / {VOID_TOWER_ROUNDS}</>
            : <>ROUND <b>{Math.max(1, game.round)}</b></>}
      </span>
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
