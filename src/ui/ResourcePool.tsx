import type { GameState, PlayerId } from "../engine";
import { enemyOf } from "../engine";
import { POI_GOLD } from "../data/domination";

export function ResourcePool(props: { game: GameState; player: PlayerId }) {
  const { game, player } = props;
  const me = game.players[player];
  const opp = game.players[enemyOf(player)];
  const twoP = (game.humans ?? ["P1"]).length > 1;
  const oppLbl = twoP ? enemyOf(player) : "Opp";
  // Income RAMPS — `poolGainForRound`, the curve Magic rides — and the bonus on
  // top is the board's: Home slots stood on, or on the 7x7 the Points held.
  // This said "+1" flat, the rule from before gold grew.
  const goldTitle = "Gold — pays to summon cards. Each round: +1 rising to +5 (the same ramp as Magic), "
    + (game.domination ? `plus ${POI_GOLD} per Point you hold` : "plus 1 per Home slot you are standing in");
  return (
    <div className="resource">
      <div className="res-gem gold" title={goldTitle}>
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
