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
  BIG_BATTLE_KINDS, BLIGHT_MAX, blightAddsFor, blightLevel, blightNodeFor, borderBossFor, borderBossScale,
  canResumeHard,
  canStartHard,
  deckCapFor, fieldedBy, fightCap, gateCheck, isBlightNode, isCleared, isGate, isHard, isOpen,
  isOverflow, isRegionCleared, recruitChance, recruitablePool, regionOfNode, terrainContested,
  type StoryNode, type StoryRegion, type StorySave,
} from "../data/story";
import { broodOf } from "./void-seat";
import { cardThumbSrc, EL_COLOR } from "./shared";
import { finisherOf } from "./DeckPickerSheet";
import { CardView } from "./CardView";
import { StorySquad } from "./StorySquad";

const KIND_LABEL: Record<StoryNode["kind"], string> = {
  skirmish: "Skirmish", warden: "Warden", landmark: "Landmark", throne: "Throne",
  blight: "Blight", gate: "Border Gate",
};

/** Fallback shape for a region with no art. Real regions carry their own
 *  `artRatio`, because the paintings are not all the same shape and forcing one
 *  ratio would crop somebody's map. The canvas holds it so a node's percentage
 *  coordinates land on the same landmark at every viewport size. */
const MAP_RATIO = 1536 / 1024;

/** A road between two nodes, as an SVG path in the map's percentage space. It
 *  bows a little rather than running dead straight, so the map reads as trails
 *  walked across the painting and not a wiring diagram. The bend is taken on
 *  SCREEN — x is stretched by the map's `ratio` first — so a road bows the same
 *  whichever way it runs, and `flip` picks the side (`roadFlips`, by id) so
 *  neighbouring roads do not all lean the same way. */
const ROAD_BOW = 0.14;
function roadPath(a: StoryNode["at"], b: StoryNode["at"], ratio: number, flip: boolean): string {
  const ax = a.x * ratio, bx = b.x * ratio;
  const dx = bx - ax, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const k = ROAD_BOW * len * (flip ? -1 : 1);
  const cx = ((ax + bx) / 2 - (dy / len) * k) / ratio;
  const cy = (a.y + b.y) / 2 + (dx / len) * k;
  return `M ${a.x} ${a.y} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${b.x} ${b.y}`;
}
const roadFlips = (a: string, b: string) =>
  [...(a + b)].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 2 === 1;

/** How far the fog lifts around a reached node, as a share of the map's WIDTH.
 *  The hole's height is scaled by the ratio, so it is round on screen rather
 *  than stretched with the viewBox. */
const FOG_R = 12;

export function StoryMap(props: {
  region: StoryRegion;
  save: StorySave;
  onFight: (node: StoryNode) => void;
  /** The squad strip writes the region's roster back through here. */
  onSave: (next: StorySave) => void;
  onOpenCollection: () => void;
  /** Open the map-selection screen. Switching regions is its job now. */
  onOpenRegions?: () => void;
  /** A node the collection asked us to show. Consumed once, then cleared by the
   *  parent — otherwise it would re-select on every later render and the player
   *  could never click away from it. */
  focusNodeId?: string | null;
  onFocusHandled?: () => void;
  /** Start HARD MODE: offered on a finished first campaign (`canStartHard`). */
  onStartHard?: () => void;
  /** Put a save back on Hard that lost its flag (`canResumeHard`). */
  onResumeHard?: () => void;
}) {
  const { region, save } = props;
  const [selId, setSelId] = useState<string | null>(null);
  // A squad card opened for a proper read. Lives here rather than in the strip
  // so the card lands over the whole screen, not inside a horizontal scroller.
  const [squadPreview, setSquadPreview] = useState<string | null>(null);

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

  const ratio = region.artRatio ?? MAP_RATIO;
  // The ground you have reached: every cleared or open node lifts the fog
  // around it, so the map fills in as the campaign walks across it. With every
  // node cleared the fog goes entirely, corners and all — the whole painting is
  // the reward for finishing it.
  const revealed = nodes.filter((n) => isCleared(save, n.id) || isOpen(save, n));
  const fogged = done < total;
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
            {region.element} · {region.terrain} · {region.board}×{region.board} · 5×5 set pieces
            {isHard(save) && <span className="story-hard-tag">Hard</span>}
          </div>
          <h2>{region.name}</h2>
        </div>
        <div className="story-stats">
          <span><b>{done}</b>/{total} nodes</span>
          <span><b>{haveHere}</b>/{regionCards.length} cards</span>
          <span>squad cap <b>{deckCapFor(save.cleared)}</b></span>
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
          {/* One button where eight element pills used to be. The pills were the
              same size whether a region was nearly cleared or had never been
              opened, and carried nothing but its element — so "where should I go
              next" could only be answered by visiting each map and reading its
              header. That question has a screen of its own now. */}
          {props.onOpenRegions && (
            <button className="maps-btn" onClick={props.onOpenRegions}>
              <i aria-hidden="true">🗺</i> Maps
            </button>
          )}
          <button className="ghost" onClick={props.onOpenCollection}>Collection</button>
          {/* No Leave button. The bottom nav sits on this screen and each of its
              other three tabs already leaves — a fifth way out was one more
              thing in a header that had run out of room. */}
        </div>
      </header>

      <div className="story-body">
        {/* The map and its squad are one column. `.story-body` is a ROW on
            desktop (map | node panel), so without this wrapper the squad strip
            becomes a THIRD column and shoves the node panel off the right edge
            of a 1440px screen. */}
        <div className="story-main">
          {props.onStartHard && canStartHard(save) && <HardOffer onStart={props.onStartHard} />}
          {props.onResumeHard && canResumeHard(save) && <HardResume onResume={props.onResumeHard} />}
          <div
            className={`story-canvas ${region.art ? "arted" : ""}`}
            style={{
              aspectRatio: String(region.artRatio ?? MAP_RATIO),
              backgroundImage: region.art ? `url(${region.art})` : undefined,
            }}
          >
            {/* viewBox 0 0 100 100 + non-uniform scaling lets the roads use the same
                percentage coordinates as the nodes, with no px maths anywhere. A
                road out of cleared ground is `live`; the one to a fight you can
                take right now is `next` and runs brightest. */}
            <svg
              className="story-edges"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {edges.map((e, i) => {
                const d = roadPath(e.from.at, e.to.at, ratio, roadFlips(e.from.id, e.to.id));
                const next = e.live && isOpen(save, e.to) && !isCleared(save, e.to.id);
                return (
                  <g key={i}>
                    <path d={d} className="trail-case" />
                    <path d={d} className={`trail ${e.live ? "live" : ""} ${next ? "next" : ""}`} />
                  </g>
                );
              })}
            </svg>
            {/* The fog: a veil over the whole painting, masked open around every
                node you have reached. Over the roads, under the nodes — a locked
                node stays findable in the dark. */}
            {fogged && (
              <svg className="story-fog" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <radialGradient id={`fog-hole-${region.id}`}>
                    <stop offset="0%" stopColor="#000" />
                    <stop offset="55%" stopColor="#000" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0" />
                  </radialGradient>
                  <mask id={`fog-${region.id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                    <rect width="100" height="100" fill="#fff" />
                    {revealed.map((n) => (
                      <ellipse key={n.id} cx={n.at.x} cy={n.at.y} rx={FOG_R} ry={FOG_R * ratio}
                        fill={`url(#fog-hole-${region.id})`} />
                    ))}
                  </mask>
                </defs>
                <rect width="100" height="100" className="fog-veil" mask={`url(#fog-${region.id})`} />
              </svg>
            )}
            {nodes.map((n) => {
              const open = isOpen(save, n), cleared = isCleared(save, n.id);
              const state = cleared ? "cleared" : open ? "open" : "locked";
              const left = recruitablePool(n).filter((id) => !owned.has(id)).length;
              const blighted = blightAddsFor(save, region, n).length > 0;
              return (
                <button
                  key={n.id}
                  className={`story-node ${state} ${n.kind} ${BIG_BATTLE_KINDS.includes(n.kind) ? "hex" : ""} ${selId === n.id ? "sel" : ""}`}
                  data-el={region.element}
                  style={pos(n)}
                  onClick={() => setSelId(n.id)}
                  aria-label={`${n.id} ${n.name}, ${KIND_LABEL[n.kind]}, ${state}`}
                >
                  {/* The medallion, in layers — see `.story-node` in styles.css. */}
                  <span className="sn-ground" aria-hidden="true" />
                  <span className="sn-glow" aria-hidden="true" />
                  {state === "open" && <span className="sn-pulse" aria-hidden="true" />}
                  <span className="sn-rim" aria-hidden="true" />
                  <span className="sn-face" aria-hidden="true" />
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

          {/* Under the map, because a squad is a property of the REGION and the
              map IS the region. It used to be visible only inside prep for one
              specific fight — the worst moment to learn you left your only healer
              in another region, one tap from a battle. */}
          <StorySquad
            save={save}
            region={region}
            onSave={props.onSave}
            onPreview={setSquadPreview}
          />
        </div>

        <aside className="story-side">
          {!sel ? (
            <p className="story-hint">Pick a node. Locked nodes show what they're waiting on.</p>
          ) : (
            <NodePanel node={sel} region={region} save={save} owned={owned} onFight={props.onFight} />
          )}
        </aside>
      </div>

      {squadPreview && (
        <CardView mode="browse" def={getDef(squadPreview)} onClose={() => setSquadPreview(null)} />
      )}
    </div>
  );
}

function NodePanel(props: {
  node: StoryNode; region: StoryRegion; save: StorySave; owned: Set<string>;
  onFight: (n: StoryNode) => void;
}) {
  const { node, save, owned } = props;
  // Which roster card is expanded, if any.
  const [loreOpen, setLoreOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const open = isOpen(save, node), cleared = isCleared(save, node.id);
  // A Blight Node is generated, so it is in no region's node list — fall back to
  // the region being viewed, which is the one it is occupying.
  const region = regionOfNode(node.id) ?? props.region;
  const blockedBy = node.requires.filter((r) => !save.cleared.includes(r));
  const pool = recruitablePool(node);
  // A node whose whole pool is already owned can never pay out. Saying so is
  // the difference between "unlucky" and "broken" from the player's side.
  const exhausted = pool.every((id) => owned.has(id));
  // FOILS DROP HERE TOO: every slot padlocked is a 1-in-100 roll for a foil of
  // one of these cards (`withFoils` in story.ts), and nothing on the map said
  // so. Tagged in the list, so the player can see which they already hold, and
  // stated under the drops — it is what a finished node still pays.
  const foils = new Set(save.hero?.shiny ?? []);
  const allFoil = pool.length > 0 && pool.every((id) => foils.has(id));
  const blightAdds = blightAddsFor(save, props.region, node);
  const contested = terrainContested(save, props.region);
  // A gate refuses on deck SHAPE, not on progress — so it needs its own reason
  // line, separate from the locked-by-prerequisites one.
  const gate = gateCheck(save, node);
  // HARD MODE: a Void Tower boss holds this border instead of a patrol.
  const boss = borderBossFor(save, node);
  /** The node's face: the toughest thing it fields.
   *
   *  Straight off the Arena's deck seats, which show a deck's finisher art for
   *  the same reason — a column of names tells you nothing about what you are
   *  walking into, and the art tells you at a glance. Deliberately the SAME
   *  `finisherOf` the Arena uses (dearest, then biggest), so "strongest" cannot
   *  come to mean two different things one screen apart.
   *
   *  Reads `fieldedBy`, so the filler a node spawns counts. Filler is cheap and
   *  loses this sort anyway; when it does win, it is genuinely the biggest thing
   *  on that board and has earned the frame. */
  const faceId = boss ?? finisherOf(fieldedBy(node));
  const face = faceId ? getDef(faceId) : null;

  return (
    <div className="node-panel">
      <div className={`np-hero ${face ? "faced" : ""}`}>
        {face && (
          <button
            className="np-face"
            style={{ backgroundImage: `url(${cardThumbSrc(face)})` }}
            title={`${face.name} — the toughest card here. Tap for the full card.`}
            aria-label={`${face.name} — see the card`}
            onClick={() => setPreviewId(face.id)}
          />
        )}
        <div className="np-head">
          <span className={`np-kind ${node.kind}`}>{boss ? "Border Boss" : KIND_LABEL[node.kind]}</span>
          {node.kind === "throne" && (
            <span className="np-flag">{node.required ? "Required" : "Optional"}</span>
          )}
          {cleared && <span className="np-flag done">Cleared</span>}
        </div>
        <h3>{node.id} · {node.name}</h3>
        {face && (
          <p className="np-boss">
            <span className="np-boss-lead">{boss ? "Boss" : "Toughest"}</span>
            <b>{face.name}</b>
            <span className={`npr-rar r-${face.rarity ?? "rare"}`}>{face.rarity ?? "rare"}</span>
            <span className="npr-cost">{face.cost}◆</span>
          </p>
        )}
      </div>
      {/* The node's facts as chips, the same as on the squad check it leads to
          (owner, 2026-10-04). A border boss is a Void Trial, and a tower fight
          runs no terrain. */}
      {region && !boss && (
        <div className="sp-facts np-facts">
          <span className="sp-fact sp-fact-el" title="Runs all battle, both sides">
            <b>{region.element}</b> · {region.terrain} all battle
          </span>
          {contested && <span className="sp-fact np-contested">Contested by Nightfall</span>}
        </div>
      )}
      {node.lore && (
        <div className="sp-lorebox">
          <p className={`np-lore sp-clamp ${loreOpen ? "open" : ""}`}>{node.lore}</p>
          <button className="sp-more" onClick={() => setLoreOpen((v) => !v)}>
            {loreOpen ? "Show less" : "Read more"}
          </button>
        </div>
      )}
      {node.note && <p className="np-note np-tip">{node.note}</p>}

      {boss && face && (
        <p className={`np-demand ${gate.ok ? "met" : ""}`}>
          Held by <b>{face.name}</b>, a Void Tower boss
          {borderBossScale(node) < 1 && <> — it and its brood fight here at {Math.round(borderBossScale(node) * 100)}% of their Tower strength</>}.
          {" "}Slay it to cross, with a full Tower deck: up to <b>{fightCap(save, region, node)}</b> cards
          {gate.ok && <span className="np-tick"> ✓ ready</span>}
        </p>
      )}
      {!boss && isGate(node) && node.demand && (
        <p className={`np-demand ${gate.ok ? "met" : ""}`}>
          {/* The number `gateCheck` ENFORCES, not the ladder's. A gate is
              fought on 4x4, so it asks for a full 4x4 deck and not the 30 the
              ladder may already allow for this region's set pieces — which is
              what this line used to print. The panel demanded a 30-card deck,
              the player brought one, and the same panel answered "your deck is
              30/18, drop 12". */}
          Demands <b>{node.demand.count} {node.demand.value}</b>
          {" "}and a full <b>{fightCap(save, region, node)}</b>-card deck
          {gate.ok && <span className="np-tick"> ✓ ready</span>}
        </p>
      )}

      <div className="np-label">{boss ? "The boss and its brood" : isGate(node) ? "Border patrol" : "Enemy squad"}</div>
      <div className="sp-grid np-grid">
        {(boss ? broodOf(boss) : isGate(node) ? node.adds : pool).map((id) => {
          const d = getDef(id);
          const have = owned.has(id);
          const over = isOverflow(node, id);
          const pity = save.pity[`${node.id}:${id}`] ?? 0;
          // What the corner says: the element on a patrol, and otherwise whether
          // you own it or what a capture would roll to recruit it.
          const tag = isGate(node) ? d.element : have ? "owned" : `${recruitChance(id, pity, over)}%`;
          return (
            <button
              key={id}
              className={`sp-tile r-${d.rarity ?? "rare"} ${have ? "have" : ""} ${over ? "overflow" : ""}`}
              title={`${d.name} · ${d.rarity ?? "rare"} · ${d.cost} gold${over ? ` · overflow from ${d.element}: half odds here, full at its home node` : ""}${!isGate(node) && !have && pity ? ` · +${pity} dry` : ""} — see the card`}
              aria-label={`${d.name} — see the card`}
              onClick={() => setPreviewId(id)}
            >
              <img src={cardThumbSrc(d)} alt="" loading="lazy"
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              <span className="sp-tile-cost">{d.cost}</span>
              <span className={`sp-tile-tag ${have && !isGate(node) ? "owned" : ""}`}>{tag}</span>
              {!isGate(node) && foils.has(id) && (
                <i className="foil-tag inline sp-tile-foil" title="You hold this card in foil">✦</i>
              )}
              <span className="sp-tile-name">{d.name}</span>
            </button>
          );
        })}
      </div>
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

      {open && isGate(node) && (
        boss ? (
          <p className="np-drops">
            Fought on the 5×5 under the Void Tower's rules: slay the boss and the border is
            yours, whatever else is standing. Nothing here joins you. Crossing opens{" "}
            <b>{(node.opens ?? []).join(" and ").toUpperCase()}</b>, and the gate stays open behind you.
          </p>
        ) : (
          <p className="np-drops">
            A border patrol of both sides — nothing here joins you. Crossing opens{" "}
            <b>{(node.opens ?? []).join(" and ").toUpperCase()}</b>, and the gate stays open behind you.
          </p>
        )
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
      {open && !isGate(node) && pool.length > 0 && (
        allFoil ? (
          <p className="np-foils done">You hold every card here in foil.</p>
        ) : (
          <p className="np-foils">
            <i className="foil-tag inline" aria-hidden="true">✦</i>
            <b>Foils drop here.</b> Every slot you padlock is a 1-in-100 shot at a foil of one
            of these cards{exhausted ? "" : " — one you don't have yet joins you in foil"}.
          </p>
        )
      )}

      {previewId && (
        <CardView mode="browse" def={getDef(previewId)} onClose={() => setPreviewId(null)} />
      )}

      {/* Pinned to the foot of the panel, above the bottom nav on a phone, so it
          is there however long the squad and the notes run. */}
      <div className="np-fightbar">
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
              // The walkthrough's first-battle step rings THIS, not the Story tab
              // it came in by: pointing at the nav while the map was up docked the
              // card on top of the one button the step was asking for.
              data-guide="story-fight"
              disabled={!gate.ok}
              title={gate.ok ? undefined : "This gate wants a finished deck"}
              onClick={() => props.onFight(node)}
            >
              {cleared ? "Fight again" : isGate(node) ? "Cross" : "Fight"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The way back for a save that lost its Hard run (`canResumeHard`). Two taps,
 *  like the offer: nothing is wiped, but there is no switching back. */
function HardResume(props: { onResume: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="hard-offer">
      {!asking ? (
        <>
          <p>
            <b>Back to Hard mode?</b> Your collection holds every region's Throne Mythic, so this
            campaign has been won before. This map can go back on Hard right where it stands.
          </p>
          <button className="lockin" onClick={() => setAsking(true)}>Hard mode</button>
        </>
      ) : (
        <>
          <p>
            <b>Your progress on this map stays.</b> Bigger squads, a Void Tower boss on every border,
            your whole collection and every spell — and no switching back.
          </p>
          <div className="hard-offer-row">
            <button className="ghost" onClick={() => setAsking(false)}>Not yet</button>
            <button className="lockin" onClick={props.onResume}>Back to Hard mode</button>
          </div>
        </>
      )}
    </div>
  );
}

/** The campaign's last word: every required Throne down, and a second run on
 *  offer. Two taps, because the first one wipes the map — it says exactly what
 *  goes and what stays before it does. */
function HardOffer(props: { onStart: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="hard-offer">
      {!asking ? (
        <>
          <p>
            <b>Every Throne has fallen.</b> Hard mode is open: walk the whole map again against
            bigger, heavier squads, with a Void Tower boss holding every border.
          </p>
          <button className="lockin" onClick={() => setAsking(true)}>Hard mode</button>
        </>
      ) : (
        <>
          <p>
            <b>The map starts over</b> — every node, the deck-size ladder and the Blight. Your
            cards, spells, shards and saved teams all come with you: every card fights in
            every region, and every spell is unlocked.
          </p>
          <div className="hard-offer-row">
            <button className="ghost" onClick={() => setAsking(false)}>Not yet</button>
            <button className="lockin" onClick={props.onStart}>Start Hard mode</button>
          </div>
        </>
      )}
    </div>
  );
}
