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
      <div>
        <div className="res-num" title="Summon pool — pays for summoning (gains = round #)">
          {me.summonPool}
        </div>
        <div className="res-lbl">Summon</div>
        <div className="res-opp">{oppLbl}: {opp.summonPool}</div>
      </div>
      <div>
        <div
          className="res-num magic"
          title="Magic pool — pays for Specials (starts at 3, +1/round)"
        >
          {me.magicPool}
        </div>
        <div className="res-lbl">Magic</div>
        <div className="res-opp">{oppLbl}: {opp.magicPool}</div>
      </div>
    </div>
  );
}
