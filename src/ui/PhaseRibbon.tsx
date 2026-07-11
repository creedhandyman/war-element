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
  return (
    <div className="phase-ribbon">
      {PHASES.map((p, i) => (
        <span key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span className="phase-arrow">→</span>}
          <div className={`phase ${game.phase === p ? "active" : ""}`}>{p}</div>
        </span>
      ))}
      <div className="waiting">
        <span className="dot-pulse" />
        <span>{statusText}</span>
      </div>
      <span className="roundchip">ROUND {Math.max(1, game.round)}</span>
    </div>
  );
}
