/** Choose a map.
 *
 *  The region switcher used to be a row of eight small element pills wedged into
 *  the map's header — the same width whether a region was two nodes from done or
 *  had never been opened, and with nothing on them but the element's name. It
 *  answered "which one am I on" and nothing else, so the question it was
 *  actually there for — where should I go next — had to be answered by visiting
 *  each map in turn and reading its header.
 *
 *  This is that question given a screen. Each region shows its own art, how far
 *  through it you are, how many of its cards you still have not found, and, if
 *  it is shut, the specific thing that opens it. The two progress bars are the
 *  point: "6/9 nodes, 14/39 cards" tells you both that a region is nearly
 *  cleared AND that it still owes you most of its collection, which are
 *  different reasons to go back and were previously invisible.
 */
import { useMemo } from "react";
import {
  BLIGHT_MAX, REGIONS, blightLevel, isCleared, isRegionCleared, isRegionOpen,
  nodeById, type StoryRegion, type StorySave,
} from "../data/story";
import { EL_COLOR } from "./shared";

export function StoryRegions(props: {
  save: StorySave;
  /** The region currently being viewed, marked as where you are. */
  currentId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { save } = props;
  const owned = useMemo(() => new Set(save.collection), [save.collection]);

  const rows = REGIONS.map((r: StoryRegion) => {
    const nodes = r.nodes;
    const done = nodes.filter((n) => isCleared(save, n.id)).length;
    const cards = [...new Set(nodes.flatMap((n) => n.roster))];
    const have = cards.filter((id) => owned.has(id)).length;
    // Blight only means anything once the region is finished — a Blight reading
    // on a region you have not cleared is a number about nothing.
    const blight = isRegionCleared(save, r) ? blightLevel(save, r) : 0;
    return {
      region: r,
      open: isRegionOpen(save, r),
      done, total: nodes.length,
      have, cards: cards.length,
      blight,
      // What actually opens it, named. "Locked" on its own is the least useful
      // thing a locked door can say.
      gates: (r.requires ?? []).map((g) => nodeById(g)?.name ?? g),
    };
  });

  const totalDone = rows.reduce((n, r) => n + r.done, 0);
  const totalNodes = rows.reduce((n, r) => n + r.total, 0);
  const openCount = rows.filter((r) => r.open).length;

  return (
    <div className="story-wrap regions-wrap">
      <header className="story-head">
        <div>
          <div className="story-eyebrow">THE WAR</div>
          <h2>Choose a map</h2>
        </div>
        <div className="story-stats">
          <span><b>{openCount}</b>/{REGIONS.length} regions open</span>
          <span><b>{totalDone}</b>/{totalNodes} nodes cleared</span>
        </div>
      </header>

      <div className="regions-grid">
        {rows.map(({ region: r, open, done, total, have, cards, blight, gates }) => {
          const here = r.id === props.currentId;
          const finished = done === total && total > 0;
          return (
            <button
              key={r.id}
              className={`rg-card ${open ? "" : "shut"} ${here ? "here" : ""} ${finished ? "done" : ""}`}
              data-el={r.element}
              disabled={!open}
              onClick={() => props.onPick(r.id)}
              title={open ? r.name : `Locked — cross ${gates.join(" or ")}`}
            >
              {/* The map's own painting, dimmed when shut. A locked region you
                  can SEE is somewhere you want to go; a grey box is not. */}
              <span
                className="rg-art"
                style={{ backgroundImage: r.art ? `url(${r.art})` : undefined }}
                aria-hidden="true"
              />
              <span className="rg-body">
                <span className="rg-top">
                  <i className="rg-el" style={{ background: EL_COLOR[r.element as keyof typeof EL_COLOR] }} />
                  <b className="rg-name">{r.name}</b>
                  {here && <em className="rg-flag">here</em>}
                  {finished && !here && <em className="rg-flag done">cleared</em>}
                </span>
                <span className="rg-terrain">
                  {r.element} · {r.terrain} · {r.board}×{r.board}
                </span>

                {open ? (
                  <>
                    {/* Two bars, because they are two different reasons to come
                        back: nodes are progress, cards are what is still owed. */}
                    <span className="rg-meter" title={`${done} of ${total} nodes cleared`}>
                      <i style={{ width: `${(done / Math.max(1, total)) * 100}%`,
                                  background: EL_COLOR[r.element as keyof typeof EL_COLOR] }} />
                    </span>
                    <span className="rg-nums">
                      <span><b>{done}</b>/{total} nodes</span>
                      <span><b>{have}</b>/{cards} cards</span>
                      {blight > 0 && (
                        <span className="rg-blight" title="DUSK has taken root here">
                          {"◆".repeat(blight)}{"◇".repeat(BLIGHT_MAX - blight)}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <span className="rg-locked">
                    <i aria-hidden="true">🔒</i>
                    {gates.length ? <>cross <b>{gates.join(" or ")}</b></> : "not yet in the world"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="regions-foot">
        <button className="ghost" onClick={props.onClose}>Back to the map</button>
      </div>
    </div>
  );
}
