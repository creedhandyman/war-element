import type { GameState } from "../engine";
import { boardCards, effectiveSp, getDef, plannedAction } from "../engine";
import { EL_COLOR } from "./shared";

export function SpeedQueue(props: { game: GameState }) {
  const { game } = props;
  const inBattle = game.phase === "battle" && game.battle !== null;

  // During battle show the locked queue; otherwise a live SP-order preview.
  const entries = inBattle
    ? game.battle!.queue.map((id, i) => ({ id, done: i < game.battle!.index }))
    : boardCards(game)
        .sort((a, b) => effectiveSp(game, b) - effectiveSp(game, a))
        .map((c) => ({ id: c.instanceId, done: false }));

  return (
    <div className="rail">
      <div className="rail-title">Speed Queue · 15 → 0</div>
      <div className="queue-scale">
        {entries.map(({ id, done }, i) => {
          const card = game.cards[id];
          if (!card)
            return (
              <div className="qrow done" key={id + i}>
                <span className="qsp">✝</span>
                <span className="qname" style={{ textDecoration: "line-through" }}>
                  defeated
                </span>
              </div>
            );
          const def = getDef(card.defId);
          const next = inBattle && i === game.battle!.index;
          const isAI = !(game.humans ?? ["P1"]).includes(card.owner);
          const tag = plannedAction(game, id);
          return (
            <div
              key={id}
              className={[
                "qrow",
                card.owner === "P1" ? "mine" : "enemy",
                next ? "next" : "",
                done ? "done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="qsp">{effectiveSp(game, card)}</span>
              <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
              <span className="qname">{def.name}</span>
              {!done && !isAI && <span className={`qtag ${tag}`}>{tag}</span>}
              {!done && isAI && <span className="qtag AUTO">AI</span>}
            </div>
          );
        })}
        {entries.length === 0 && (
          <div style={{ color: "var(--ink-faint)", fontSize: 11 }}>Board is empty.</div>
        )}
      </div>
      <div className="queue-help">
        Battle acts top-down. Higher SP first; ties → seeded coin flip. Tags show each of
        your cards' planned action.
      </div>
    </div>
  );
}
