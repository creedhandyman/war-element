import type { GameState } from "../engine";

export function ResourcePool(props: { game: GameState }) {
  const { game } = props;
  const p1 = game.players.P1;
  const p2 = game.players.P2;
  return (
    <div className="resource">
      <div>
        <div className="res-num" title="Summon pool — pays for summoning (gains = round #)">
          {p1.summonPool}
        </div>
        <div className="res-lbl">Summon</div>
        <div className="res-opp">Opp: {p2.summonPool}</div>
      </div>
      <div>
        <div
          className="res-num magic"
          title="Magic pool — pays for Specials (starts at 3, +1/round)"
        >
          {p1.magicPool}
        </div>
        <div className="res-lbl">Magic</div>
        <div className="res-opp">Opp: {p2.magicPool}</div>
      </div>
    </div>
  );
}
