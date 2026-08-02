/** Story Mode — the region map.
 *
 *  The map IS the progression system, so this screen carries the campaign's
 *  whole state read-out: which nodes are open, what each one is guarding, and
 *  what you still don't own. Node connections are drawn from each node's
 *  `requires` list rather than a separate edge table — one source of truth, and
 *  a node can never render an edge it doesn't actually gate on.
 */
import { useMemo, useState } from "react";
import { getDef } from "../data/cards";
import {
  deckCapFor, isCleared, isOpen, recruitChance, regionOfNode,
  type StoryNode, type StoryRegion, type StorySave,
} from "../data/story";
import { EL_COLOR } from "./shared";

const KIND_LABEL: Record<StoryNode["kind"], string> = {
  skirmish: "Skirmish", warden: "Warden", landmark: "Landmark", throne: "Throne",
};

/** Abstract map units -> px. */
const GX = 118, GY = 92, PAD = 46;

export function StoryMap(props: {
  region: StoryRegion;
  save: StorySave;
  onFight: (node: StoryNode) => void;
  onClose: () => void;
  onOpenCollection: () => void;
}) {
  const { region, save } = props;
  const [selId, setSelId] = useState<string | null>(null);

  const w = Math.max(...region.nodes.map((n) => n.at.x)) * GX + PAD * 2;
  const h = Math.max(...region.nodes.map((n) => n.at.y)) * GY + PAD * 2;
  const pos = (n: StoryNode) => ({ left: PAD + n.at.x * GX, top: PAD + n.at.y * GY });

  const sel = selId ? region.nodes.find((n) => n.id === selId) ?? null : null;
  const owned = useMemo(() => new Set(save.collection), [save.collection]);

  // Edges come straight from `requires`, so the drawn map can't drift from the
  // gating the campaign actually enforces.
  const edges = region.nodes.flatMap((n) =>
    n.requires
      .map((r) => region.nodes.find((x) => x.id === r))
      .filter((from): from is StoryNode => !!from)
      .map((from) => ({ from, to: n, live: isCleared(save, from.id) })),
  );

  const total = region.nodes.length;
  const done = region.nodes.filter((n) => isCleared(save, n.id)).length;
  const regionCards = region.nodes.flatMap((n) => n.roster);
  const haveHere = regionCards.filter((id) => owned.has(id)).length;

  return (
    <div className="story-wrap">
      <header className="story-head">
        <div>
          <div className="story-eyebrow" style={{ color: EL_COLOR[region.element as keyof typeof EL_COLOR] }}>
            {region.element} · {region.terrain} · {region.board}×{region.board}
          </div>
          <h2>{region.name}</h2>
        </div>
        <div className="story-stats">
          <span><b>{done}</b>/{total} nodes</span>
          <span><b>{haveHere}</b>/{regionCards.length} cards</span>
          <span>deck cap <b>{deckCapFor(save.cleared)}</b></span>
        </div>
        <div className="story-actions">
          <button className="ghost" onClick={props.onOpenCollection}>Collection</button>
          <button className="ghost" onClick={props.onClose}>Leave</button>
        </div>
      </header>

      <div className="story-body">
        <div className="story-canvas" style={{ width: w, height: h }}>
          <svg className="story-edges" width={w} height={h} aria-hidden="true">
            {edges.map((e, i) => {
              const a = pos(e.from), b = pos(e.to);
              return (
                <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top}
                  className={e.live ? "edge live" : "edge"} />
              );
            })}
          </svg>
          {region.nodes.map((n) => {
            const open = isOpen(save, n), cleared = isCleared(save, n.id);
            const state = cleared ? "cleared" : open ? "open" : "locked";
            const left = regionCards.length ? n.roster.filter((id) => !owned.has(id)).length : 0;
            return (
              <button
                key={n.id}
                className={`story-node ${state} ${n.kind} ${selId === n.id ? "sel" : ""}`}
                style={{ ...pos(n), ["--el" as string]: EL_COLOR[region.element as keyof typeof EL_COLOR] }}
                onClick={() => setSelId(n.id)}
                aria-label={`${n.id} ${n.name}, ${KIND_LABEL[n.kind]}, ${state}`}
              >
                <span className="sn-id">{n.id}</span>
                {n.kind === "throne" && <span className="sn-crown">{n.required ? "★" : "☆"}</span>}
                {!open && <span className="sn-lock">🔒</span>}
                {open && !cleared && left > 0 && <span className="sn-left">{left}</span>}
                {cleared && <span className="sn-tick">✓</span>}
              </button>
            );
          })}
        </div>

        <aside className="story-side">
          {!sel ? (
            <p className="story-hint">Pick a node. Locked nodes show what they're waiting on.</p>
          ) : (
            <NodePanel node={sel} save={save} owned={owned} onFight={props.onFight} />
          )}
        </aside>
      </div>
    </div>
  );
}

function NodePanel(props: {
  node: StoryNode; save: StorySave; owned: Set<string>; onFight: (n: StoryNode) => void;
}) {
  const { node, save, owned } = props;
  const open = isOpen(save, node), cleared = isCleared(save, node.id);
  const region = regionOfNode(node.id);
  const blockedBy = node.requires.filter((r) => !save.cleared.includes(r));
  // A node whose whole roster is already owned can never pay out. Saying so is
  // the difference between "unlucky" and "broken" from the player's side.
  const exhausted = node.roster.every((id) => owned.has(id));

  return (
    <div className="node-panel">
      <div className="np-head">
        <span className={`np-kind ${node.kind}`}>{KIND_LABEL[node.kind]}</span>
        {node.kind === "throne" && (
          <span className="np-flag">{node.required ? "Required" : "Optional"}</span>
        )}
        {cleared && <span className="np-flag done">Cleared</span>}
      </div>
      <h3>{node.id} · {node.name}</h3>
      {node.note && <p className="np-note">{node.note}</p>}
      {region && <p className="np-terrain">Terrain: <b>{region.terrain}</b> — runs all battle, both sides.</p>}

      <div className="np-label">Enemy squad</div>
      <ul className="np-roster">
        {node.roster.map((id) => {
          const d = getDef(id);
          const have = owned.has(id);
          const pity = save.pity[`${node.id}:${id}`] ?? 0;
          return (
            <li key={id} className={have ? "have" : ""}>
              <span className="npr-name">{d.name}</span>
              <span className={`npr-rar r-${d.rarity ?? "rare"}`}>{d.rarity ?? "rare"}</span>
              <span className="npr-cost">{d.cost}◆</span>
              <span className="npr-drop">
                {have ? "owned" : `${recruitChance(id, pity)}%${pity ? ` (+${pity} dry)` : ""}`}
              </span>
            </li>
          );
        })}
      </ul>
      {node.adds.length > 0 && (
        <p className="np-adds">
          Plus {node.adds.map((id) => getDef(id).name).join(", ")} — spawned filler, not recruitable.
        </p>
      )}

      {!open ? (
        <p className="np-blocked">Locked. Clear {blockedBy.join(" and ")} first.</p>
      ) : (
        <button className="lockin np-fight" onClick={() => props.onFight(node)}>
          {cleared ? "Fight again" : "Fight"}
        </button>
      )}
      {open && (
        exhausted ? (
          <p className="np-drops exhausted">
            You already own everything here. Clearing it still pays Gold and essence,
            but there is nothing left to recruit.
          </p>
        ) : (
          <p className="np-drops">
            Recruit rolls are earned by <b>capture</b> — one per slot you padlock.
            {cleared && " Repeat clears pay full recruit odds."}
          </p>
        )
      )}
    </div>
  );
}
