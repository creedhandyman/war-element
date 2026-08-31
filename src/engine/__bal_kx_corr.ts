// [kx] Corridor-Special instrument. Scratch — delete before returning.
// For every AI cast of an aimed corridor Special in real games, records:
//   offered = |specialTargets| (on 7x7 Domination this is the UNION of all four
//             corridors — i.e. exactly the victim set the pre-fix four-lane
//             nova would have hit)
//   aimed   = bodies the AI's chosen lane actually catches (post-fix reality)
//   best    = bodies the FULLEST legal lane would have caught (a perfect aimer)
import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { shelfFor } from "./__bal_harness";
import { chooseBattleAction } from "./ai";
import { specialTargets, forwardAreaTargets, corridorDir, canFireSpecial, CORRIDOR_DIRS } from "./rules";
import { getDef } from "../data/cards";

const arg = (k: string, d: string) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};
const CARD = arg("card", "aqua_octoirate");
const N = Number(arg("n", "300"));
const COPIES = Number(arg("copies", "6"));
const BOARD = arg("board", "7dom");
const cfg = BOARD === "7dom" ? { boardSize: 7, dom: true }
  : BOARD === "7plain" ? { boardSize: 7, dom: false }
  : BOARD === "5" ? { boardSize: 5, dom: false }
  : { boardSize: 4, dom: false };

const shelf = shelfFor(7);
const BASES = ["pre_inferno_blitz_5", "pre_frostkeep_5", "pre_radiant_host_5", "pre_nightfall_5"]
  .map((id) => shelf.find((d) => d.id === id)!);

let casts = 0, offeredSum = 0, aimedSum = 0, bestSum = 0, aimedLE1 = 0, bestLE1 = 0, noTargetId = 0;
let deploys = 0, rounds = 0;
const laneHist: Record<number, number> = {};
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const base = BASES[i % BASES.length];
  const deck = [...Array(COPIES).fill(CARD), ...base.cards.slice(COPIES)];
  let s = createInitialState(i * 7919 + 13, deck, base.cards, [], base.spells, base.spells, cfg.boardSize);
  if (cfg.dom) s.domination = newDomination(DOMINATION_7X7);
  let steps = 0;
  const seenDeploy = new Set<string>();
  while (s.phase !== "gameover" && steps < 20000) {
    const id = s.battle ? s.battle.queue[s.battle.index] : undefined;
    if (id && s.cards[id] && s.cards[id].defId === CARD && s.cards[id].pos && s.cards[id].owner === "P1") {
      const card = s.cards[id];
      seenDeploy.add(id);
      const sp = getDef(card.defId).special!;
      const fdp = Number(sp.params?.forwardDepth ?? 0);
      const spread = Number(sp.params?.spread ?? 0);
      if (canFireSpecial(s, id).ok) {
        const choice = chooseBattleAction(s, id);
        if (choice.action === "special") {
          const offered = specialTargets(s, id);
          let aimed = 0;
          if (choice.targetId) {
            const t = offered.find((x) => x.instanceId === choice.targetId);
            if (t?.pos) {
              const lane = forwardAreaTargets(s, card, spread, fdp, corridorDir(card.pos!, t.pos));
              aimed = lane.some((x) => x.instanceId === t.instanceId) ? lane.length : 1;
            }
          } else { noTargetId++; aimed = offered.length; }
          let best = 0;
          for (const d of CORRIDOR_DIRS)
            best = Math.max(best, forwardAreaTargets(s, card, spread, fdp, d).length);
          if (!cfg.dom) { // plain board: no aiming, the corridor points at the enemy home
            aimed = offered.length; best = offered.length;
          }
          casts++; offeredSum += offered.length; aimedSum += aimed; bestSum += best;
          if (aimed <= 1) aimedLE1++;
          if (best <= 1) bestLE1++;
          laneHist[aimed] = (laneHist[aimed] ?? 0) + 1;
        }
      }
    }
    const nx = advance(s); steps++;
    if (nx === s) break;
    s = nx;
  }
  deploys += seenDeploy.size; rounds += s.round;
}
const f = (x: number) => (x / Math.max(1, casts)).toFixed(2);
console.log(`${CARD}\t${BOARD}\tgames=${N}\tavgRounds=${(rounds/N).toFixed(1)}\tdistinctBodiesSeen/game=${(deploys/N).toFixed(2)}`
  + `\tcasts=${casts} (${(casts/N).toFixed(2)}/game)\toffered/cast=${f(offeredSum)}\taimed/cast=${f(aimedSum)}\tbest/cast=${f(bestSum)}`
  + `\taimed<=1:${(100*aimedLE1/Math.max(1,casts)).toFixed(0)}%\tbest<=1:${(100*bestLE1/Math.max(1,casts)).toFixed(0)}%\tnoAim=${noTargetId}\t${((Date.now()-t0)/1000).toFixed(0)}s`);
console.log("  aimed-lane size histogram:", JSON.stringify(laneHist));
