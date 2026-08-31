function mul(a: number): number { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
// rand() = mulberry32((seed + k)|0) for the k-th draw. Two 30-card shuffles
// (29 swaps each) precede the coin, so the coin is draw 59. (state.ts:129-133)
const S = (i: number) => i * 7919 + 13;
for (const [name, f] of [["stride i*7919+13", S], ["sequential i+1", (i: number) => i + 1]] as const) {
  for (const n of [2000, 20000, 200000]) {
    let p1 = 0;
    for (let i = 0; i < n; i++) if (mul((f(i) + 59) | 0) < 0.5) p1++;
    console.log(`${name.padEnd(18)} n=${String(n).padEnd(7)} firstPlayer=P1 ${(100 * p1 / n).toFixed(2)}%`);
  }
}
