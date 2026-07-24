import type { GameState, PlayerId } from "../engine";
import { enemyOf } from "../engine";

export function ResourcePool(props: { game: GameState; player: PlayerId }) {
  const { game, player } = props;
  const me = game.players[player];
  const opp = game.players[enemyOf(player)];
  const twoP = (game.humans ?? ["P1"]).length > 1;
  const oppLbl = twoP ? enemyOf(player) : "Opp";
  return (
    <div className="resource">
      <div className="res-gem gold" title="Gold — pays to summon cards (you gain the round number each round)">
        <div className="gem-face"><span className="gem-val">{me.gold}</span></div>
        <div className="gem-info">
          <div className="gem-lbl">GOLD</div>
          <div className="gem-opp">{oppLbl} · {opp.gold}</div>
        </div>
      </div>
      <div className="res-gem magic" title="Magic — pays for Specials & Spells">
        <div className="gem-face"><span className="gem-val">{me.magicPool}</span></div>
        <div className="gem-info">
          <div className="gem-lbl">MAGIC</div>
          <div className="gem-opp">{oppLbl} · {opp.magicPool}</div>
        </div>
      </div>
    </div>
  );
}
