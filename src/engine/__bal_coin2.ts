import { createInitialState } from "./index";
import { shelfFor } from "./__bal_harness";
const d = shelfFor(7)[0];
function mul(a: number): number { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
let agree = 0, p1 = 0; const n = 300;
for (let i = 0; i < n; i++) { const seed = i * 7919 + 13;
  const st = createInitialState(seed, d.cards, d.cards, [], d.spells, d.spells, 7);
  const pred = mul((seed + 59) | 0) < 0.5 ? "P1" : "P2";
  if (pred === st.firstPlayer) agree++; if (st.firstPlayer === "P1") p1++; }
console.log(`model agrees with engine on ${agree}/${n};  actual firstPlayer=P1 ${(100*p1/n).toFixed(1)}%`);
