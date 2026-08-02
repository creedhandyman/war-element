/** Story Mode — the region map.
 *
 *  The map IS the progression system, so this screen carries the campaign's
 *  whole state read-out: which nodes are open, what each one is guarding, and
 *  what you still don't own. Node connections are drawn from each node's
 *  `requires` list rather than a separate edge table — one source of truth, and
 *  a node can never render an edge it doesn't actually gate on.
 */
import { useEffect, useMemo, useState } from "react";
import { getDef } from "../data/cards";
import {
  BLIGHT_MAX, REGIONS, blightAddsFor, blightLevel, blightNodeFor, deckCapFor,
  gateCheck, isBlightNode, isCleared, isGate, isOpen, isOverflow, isRegionCleared,
  isRegionOpen, nodeById, recruitChance, recruitablePool, regionOfNode, terrainContested,
  type StoryNode, type StoryRegion, type StorySave,
} from "../data/story";
import { EL_COLOR } from "./shared";

const KIND_LABEL: Record<StoryNode["kind"], string> = {
  skirmish: "Skirmish", warden: "Warden", landmark: "Landmark", throne: "Throne",
  blight: "Blight", gate: "Border Gate",
};

/** Fallback shape for a region with no art. Real regions carry their own
 *  `artRatio`, because the paintings are not all the same shape and forcing one
 *  ratio would crop somebody's map. The canvas holds it so a node's percentage
 *  coordinates land on the same landmark at every viewport size. */
const MAP_RATIO = 1536 / 1024;

export function StoryMap(props: {
  region: StoryRegion;
  save: StorySave;
  onFight: (node: StoryNode) => void;
  onClose: () => void;
  onOpenCollection: () => void;
  /** Switch which region's map is showing. */
  onRegion?: (id: string) => void;
  /** A node the collection asked us to show. Consumed once, then cleared by the
   *  parent — otherwise it would re-select on every later render and the player
   *  could never click away from it. */
  focusNodeId?: string | null;
  onFocusHandled?: () => void;
}) {
  const { region, save } = props;
  const [selId, setSelId] = useState<string | null>(null);

  const { focusNodeId, onFocusHandled } = props;
  useEffect(() => {
    if (!focusNodeId) return;
    setSelId(focusNodeId);
    onFocusHandled?.();
  }, [focusNodeId, onFocusHandled]);

  // The Blight Node is generated, not authored — it exists only while the region
  // sits at the cap, so it is folded in here rather than living in the data.
  const blightNode = blightNodeFor(save, region);
  const nodes = blightNode ? [...region.nodes, blightNode] : region.nodes;

  // Percentages, so the layout is resolution-independent and the art can be
  // re-exported at any size without moving a single node.
  const pos = (n: StoryNode) => ({ left: `${n.at.x}%`, top: `${n.at.y}%` });

  const sel = selId ? nodes.find((n) => n.id === selId) ?? null : null;
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
  // Blight is only real once the region is finished, so it only reads out then --
  // a number on a region that cannot be Blighted would just be noise.
  const blight = isRegionCleared(save, region) ? blightLevel(save, region) : 0;

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
          {blight > 0 && (
            <span
              className="story-blight"
              title="DUSK has taken root here. Warden-tier nodes and up fight with extra shadow."
            >
              blight <b>{"◆".repeat(blight)}{"◇".repeat(BLIGHT_MAX - blight)}</b>
            </span>
          )}
        </div>
        <div className="story-actions">
          {/* Only render the switcher once a second region is actually reachable
              — a lone disabled tab is just noise during Act I. */}
          {props.onRegion && REGIONS.some((r) => r.id !== region.id && isRegionOpen(save, r)) && (
            <div className="story-regions">
              {REGIONS.map((r) => {
                const unlocked = isRegionOpen(save, r);
                // Name it even when locked. With eight regions a row of bare
                // padlocks is unreadable — you cannot tell PYRO from DAWN, and
                // seeing the world laid out is half the point of the switcher.
                const gates = (r.requires ?? []).map((g) => nodeById(g)?.name ?? g);
                return (
                  <button
                    key={r.id}
                    className={`db-fl rg ${r.id === region.id ? "on" : ""} ${unlocked ? "" : "shut"}`}
                    disabled={!unlocked}
                    title={unlocked ? r.name : `Locked — cross ${gates.join(" or ")}`}
                    onClick={() => props.onRegion!(r.id)}
                  >
                    {!unlocked && <span className="rg-lock" aria-hidden="true">🔒</span>}
                    {r.element}
                  </button>
                );
              })}
            </div>
          )}
          <button className="ghost" onClick={props.onOpenCollection}>Collection</button>
          <button className="ghost" onClick={props.onClose}>Leave</button>
        </div>
      </header>

      <div className="story-body">
        <div
          className={`story-canvas ${region.art ? "arted" : ""}`}
          style={{
            aspectRatio: String(region.artRatio ?? MAP_RATIO),
            backgroundImage: region.art ? `url(${region.art})` : undefined,
          }}
        >
          {/* viewBox 0 0 100 100 + non-uniform scaling lets the edges use the same
              percentage coordinates as the nodes, with no px maths anywhere. */}
          <svg
            className="story-edges"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {edges.map((e, i) => (
              <line key={i}
                x1={e.from.at.x} y1={e.from.at.y} x2={e.to.at.x} y2={e.to.at.y}
                className={e.live ? "edge live" : "edge"} />
            ))}
          </svg>
          {nodes.map((n) => {
            const open = isOpen(save, n), cleared = isCleared(save, n.id);
            const state = cleared ? "cleared" : open ? "open" : "locked";
            const left = recruitablePool(n).filter((id) => !owned.has(id)).length;
            const blighted = blightAddsFor(save, region, n).length > 0;
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
                {isGate(n) && <span className="sn-gate" aria-hidden="true">⇥</span>}
                {!open && <span className="sn-lock">🔒</span>}
                {open && !cleared && left > 0 && <span className="sn-left">{left}</span>}
                {cleared && !isBlightNode(n) && <span className="sn-tick">✓</span>}
                {(blighted || isBlightNode(n)) && <span className="sn-blight" aria-hidden="true">☠</span>}
              </button>
            );
          })}
        </div>

        <aside className="story-side">
          {!sel ? (
            <p className="story-hint">Pick a node. Locked nodes show what they're waiting on.</p>
          ) : (
            <NodePanel node={sel} region={region} save={save} owned={owned} onFight={props.onFight} />
          )}
        </aside>
      </div>
    </div>
  );
}

function NodePanel(props: {
  node: StoryNode; region: StoryRegion; save: StorySave; owned: Set<string>;
  onFight: (n: StoryNode) => void;
}) {
  const { node, save, owned } = props;
  const open = isOpen(save, node), cleared = isCleared(save, node.id);
  // A Blight Node is generated, so it is in no region's node list — fall back to
  // the region being viewed, which is the one it is occupying.
  const region = regionOfNode(node.id) ?? props.region;
  const blockedBy = node.requires.filter((r) => !save.cleared.includes(r));
  const pool = recruitablePool(node);
  // A node whose whole pool is already owned can never pay out. Saying so is
  // the difference between "unlucky" and "broken" from the player's side.
  const exhausted = pool.every((id) => owned.has(id));
  const blightAdds = blightAddsFor(save, props.region, node);
  const contested = terrainContested(save, props.region);
  // A gate refuses on deck SHAPE, not on progress — so it needs its own reason
  // line, separate from the locked-by-prerequisites one.
  const gate = gateCheck(save, node);

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
      {region && (
        <p className="np-terrain">
          Terrain: <b>{region.terrain}</b> — runs all battle, both sides.
          {contested && <> Contested by Nightfall — the Blight is fighting it.</>}
        </p>
      )}

      {isGate(node) && node.demand && (
        <p className={`np-demand ${gate.ok ? "met" : ""}`}>
          Demands <b>{node.demand.count} {node.demand.value}</b>
          {" "}and a full <b>{deckCapFor(save.cleared)}</b>-card deck
          {gate.ok && <span className="np-tick"> ✓ ready</span>}
        </p>
      )}

      <div className="np-label">{isGate(node) ? "Border patrol" : "Enemy squad"}</div>
      <ul className="np-roster">
        {(isGate(node) ? node.adds : pool).map((id) => {
          const d = getDef(id);
          const have = owned.has(id);
          const over = isOverflow(node, id);
          const pity = save.pity[`${node.id}:${id}`] ?? 0;
          return (
            <li key={id} className={`${have ? "have" : ""} ${over ? "overflow" : ""}`}>
              <span className="npr-name">
                {d.name}
                {over && (
                  <span
                    className="npr-over"
                    title={`Overflow from ${d.element} — half odds here, full odds at its home node.`}
                  >
                    {d.element}
                  </span>
                )}
              </span>
              <span className={`npr-rar r-${d.rarity ?? "rare"}`}>{d.rarity ?? "rare"}</span>
              <span className="npr-cost">{d.cost}◆</span>
              <span className="npr-drop">
                {isGate(node)
                  ? getDef(id).element
                  : have ? "owned" : `${recruitChance(id, pity, over)}%${pity ? ` (+${pity} dry)` : ""}`}
              </span>
            </li>
          );
        })}
      </ul>
      {node.adds.length > 0 && !isGate(node) && (
        <p className="np-adds">
          Plus {node.adds.map((id) => getDef(id).name).join(", ")} — spawned filler, not recruitable.
        </p>
      )}
      {blightAdds.length > 0 && (
        <p className="np-adds blight">
          Blighted — {blightAdds.map((id) => getDef(id).name).join(" and ")}{" "}
          {blightAdds.length === 1 ? "fights" : "fight"} alongside them.
          Not recruitable here; DUSK only joins you from its own region.
        </p>
      )}

      {!open ? (
        <p className="np-blocked">Locked. Clear {blockedBy.join(" and ")} first.</p>
      ) : (
        <>
          {isGate(node) && !gate.ok && (
            <div className="np-gate">
              {gate.reasons.map((r) => <p key={r} className="np-blocked">{r}</p>)}
            </div>
          )}
          <button
            className="lockin np-fight"
            disabled={!gate.ok}
            title={gate.ok ? undefined : "This gate wants a finished deck"}
            onClick={() => props.onFight(node)}
          >
            {cleared ? "Fight again" : isGate(node) ? "Cross" : "Fight"}
          </button>
        </>
      )}
      {open && isGate(node) && (
        <p className="np-drops">
          A border patrol of both sides — nothing here joins you. Crossing opens{" "}
          <b>{(node.opens ?? []).join(" and ").toUpperCase()}</b>, and the gate stays open behind you.
        </p>
      )}
      {open && !isGate(node) && (
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
