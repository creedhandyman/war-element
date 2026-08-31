// [kx] Per-card win-rate contribution sweep. Scratch — delete before returning.
import { writeFileSync, readdirSync, readFileSync, existsSync } from "fs";
import { runGame, shelfFor } from "./__bal_harness";
import { CARDS } from "../data/cards";

const arg = (k: string, d: string) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=").slice(1).join("=") : d;
};

const BOARD = arg("board", "7dom");
const N = Number(arg("n", "160"));
const COPIES = Number(arg("copies", "6"));
const OUT = arg("out", "");
const [SI, SM] = arg("slice", "0/1").split("/").map(Number);
const ONLY = arg("only", "");

const CFG: Record<string, { boardSize: number; mode: "domination" | "plain" }> = {
  "7dom":   { boardSize: 7, mode: "domination" },
  "7plain": { boardSize: 7, mode: "plain" },
  "5":      { boardSize: 5, mode: "plain" },
  "4":      { boardSize: 4, mode: "plain" },
};
const cfg = CFG[BOARD];

const shelf = shelfFor(7);
const BASE_IDS = ["pre_inferno_blitz_5", "pre_frostkeep_5", "pre_radiant_host_5", "pre_nightfall_5"];
const BASES = BASE_IDS.map((id) => shelf.find((d) => d.id === id)!);

const pool = CARDS.filter((c) => c.cost < 12 && !c.id.startsWith("boss_")).map((c) => c.id);
const DIR = arg("dir", "");            // resume: skip cards already in DIR/<board>.*.jsonl
let ids = ONLY ? ONLY.split(",") : ["__mirror__", ...pool];
if (DIR && existsSync(DIR)) {
  const done = new Set<string>();
  for (const f of readdirSync(DIR)) {
    if (!f.startsWith(`${BOARD}.`) || !f.endsWith(".jsonl")) continue;
    let txt = ""; try { txt = readFileSync(`${DIR}/${f}`, "utf8"); } catch { continue; }
    for (const line of txt.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); if ((r.n ?? 0) >= N) done.add(r.card); } catch { /* half-written line */ }
    }
  }
  ids = ids.filter((c) => !done.has(c));
  console.log(`# resume: ${done.size} done, ${ids.length} left`);
}
const mine = ids.filter((_, i) => i % SM === SI);

type Row = {
  card: string; board: string; n: number; wins: number; draws: number; errors: number;
  rounds: number; deployed: number; goldTest: number; pointRounds: number; kills: number;
};
const out: Row[] = [];
const t0 = Date.now();
for (const card of mine) {
  const r: Row = { card, board: BOARD, n: 0, wins: 0, draws: 0, errors: 0,
    rounds: 0, deployed: 0, goldTest: 0, pointRounds: 0, kills: 0 };
  for (let i = 0; i < N; i++) {
    const base = BASES[i % BASES.length];
    const testDeck = card === "__mirror__"
      ? base.cards
      : [...Array(COPIES).fill(card), ...base.cards.slice(COPIES)];
    const testIsP1 = i % 2 === 0;
    const g = runGame({
      seed: i * 7919 + 13, boardSize: cfg.boardSize, mode: cfg.mode, seats: 2,
      trackPoints: false,
      decks: testIsP1 ? [testDeck, base.cards] : [base.cards, testDeck],
      spells: [base.spells, base.spells],
    });
    const testSeat = testIsP1 ? "P1" : "P2";
    r.n++;
    if (g.by === "error") { r.errors++; continue; }
    if (g.winner === testSeat) r.wins++;
    else if (g.winner === null) r.draws++;
    r.rounds += g.rounds;
    const st = g.seatStats[testSeat];
    r.deployed += st.cardsDeployed; r.goldTest += st.goldEarned;
    r.pointRounds += st.pointRounds; r.kills += st.kills;
  }
  out.push(r);
  const pct = (100 * r.wins / Math.max(1, r.n - r.errors)).toFixed(1);
  console.log(`${BOARD} ${card} ${pct}% (${r.wins}/${r.n}) err${r.errors} r${(r.rounds/r.n).toFixed(1)} dep${(r.deployed/r.n).toFixed(1)}`);
  if (OUT) writeFileSync(OUT, out.map((x) => JSON.stringify(x)).join("\n") + "\n");
}
console.log(`# slice ${SI}/${SM} board ${BOARD} cards ${mine.length} in ${((Date.now()-t0)/1000).toFixed(0)}s`);
