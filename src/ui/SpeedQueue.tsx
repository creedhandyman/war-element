import type { GameState } from "../engine";
import { boardCards, effectiveSp, getDef, plannedAction } from "../engine";
import { EL_COLOR } from "./shared";

/** What the queue tags SAY vs what they mean. "SKIP" read like a choice the
 *  player was making; it actually means the card has no legal action at all. */
const TAG_LABEL: Record<string, string> = { YOU: "YOU", AUTO: "AUTO", SKIP: "CAN'T ACT" };
const TAG_HELP: Record<string, string> = {
  YOU: "Your call — you'll pick Basic / Special / Skip when this card comes up.",
  AUTO: "Set to auto — this card takes its turn by itself. Tap the badge on the card to change it.",
  SKIP: "No legal action: nothing in range to attack and no Special it can afford or fire. It will pass its turn.",
};

export function SpeedQueue(props: { game: GameState }) {
  const { game } = props;
  const inBattle = game.phase === "battle" && game.battle !== null;

  // During battle show the locked queue; otherwise a live SP-order preview.
  //
  // The preview has to apply the SAME scenery rule the real queue does
  // (`noBattleTurn`, skipped when the queue is built). It built its own list
  // straight off the board, so the five Fortress Gates went on showing five
  // "CAN'T ACT" rows all the way through prep and only vanished once the battle
  // queue was locked — the half of the round where the player is actually
  // reading this panel to decide anything.
  const entries = inBattle
    ? game.battle!.queue.map((id, i) => ({ id, done: i < game.battle!.index }))
    : boardCards(game)
        .filter((c) => !getDef(c.defId).noBattleTurn)
        .sort((a, b) => effectiveSp(game, b) - effectiveSp(game, a))
        .map((c) => ({ id: c.instanceId, done: false }));

  return (
    <div className="rail queue-rail">
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
              <span className="qsp" title={`Speed ${effectiveSp(game, card)} — the queue acts fastest first`}>
                {effectiveSp(game, card)}
              </span>
              <span className="el-dot" style={{ background: EL_COLOR[def.element] }} />
              <span className="qname">{def.name}</span>
              {!done && !isAI && (
                <span className={`qtag ${tag}`} title={TAG_HELP[tag]}>
                  {TAG_LABEL[tag]}
                </span>
              )}
              {!done && isAI && (
                <span className="qtag AUTO" title="Opponent's card — the AI takes this turn.">AI</span>
              )}
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
