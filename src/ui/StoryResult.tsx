/** Story Mode — the post-battle recruitment card.
 *
 *  Shown after a story node is cleared. It has to answer two questions fast:
 *  what did I get, and why that much — hence the capture count is stated
 *  outright, since capture is what earns the rolls.
 */
import { getDef } from "../data/cards";
import { isGate, type StoryNode } from "../data/story";

export function StoryResult(props: {
  node: StoryNode;
  won: string[];
  captured: number;
  firstClear: boolean;
  /** True when the whole roster was already owned — "unlucky" would be a lie. */
  exhausted: boolean;
  onDone: () => void;
}) {
  const { node, won, captured, firstClear } = props;
  const rolls = Math.max(1, captured);

  return (
    <div className="overlay on-top">
      <div className="modal story-result">
        <h1>{isGate(node) ? "Border crossed" : `${node.name} cleared`}</h1>
        {isGate(node) ? (
          <p>
            The patrol is broken. <b>{(node.opens ?? []).join(" and ").toUpperCase()}</b> is
            open, and this gate stays open behind you.
          </p>
        ) : (
        <p>
          {captured > 0
            ? <>You padlocked <b>{captured}</b> {captured === 1 ? "slot" : "slots"} — {rolls} recruit {rolls === 1 ? "roll" : "rolls"}.</>
            : <>Won by elimination — no slots padlocked, so one roll.</>}
        </p>
        )}

        {isGate(node) ? null : won.length > 0 ? (
          <>
            <div className="sr-label">Recruited</div>
            <ul className="sr-list">
              {won.map((id) => {
                const d = getDef(id);
                return (
                  <li key={id}>
                    <span className="sr-name">{d.name}</span>
                    <span className={`npr-rar r-${d.rarity ?? "rare"}`}>{d.rarity ?? "rare"}</span>
                    <span className="sr-stats">{d.cost}◆ · {d.dmg}{(d.hits ?? 1) > 1 ? `×${d.hits}` : ""} · {d.hp} hp</span>
                  </li>
                );
              })}
            </ul>
            {node.kind === "throne" && firstClear && (
              <p className="sr-note">Throne bosses are a guaranteed recruit on first clear.</p>
            )}
          </>
        ) : (
          <p className="sr-empty">
            {props.exhausted
              ? "You already own every card here — nothing left to recruit."
              : "Nothing joined this time. Every dry clear raises the odds here — come back."}
          </p>
        )}

        <button className="lockin" onClick={props.onDone}>Back to the map</button>
      </div>
    </div>
  );
}
