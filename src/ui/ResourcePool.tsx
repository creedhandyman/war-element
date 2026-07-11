import type { GameState } from "../engine";

export function ResourcePool(props: { game: GameState }) {
  const { game } = props;
  return (
    <div className="resource">
      <div className="res-num">{game.players.P1.pool}</div>
      <div>
        <div className="res-lbl">
          Resource
          <br />
          Pool
        </div>
        <div className="res-opp">Opp: {game.players.P2.pool}</div>
      </div>
    </div>
  );
}
