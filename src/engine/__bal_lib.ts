export function wilson(k: number, n: number) {
  const z = 1.959964, p = k / n;
  const d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [100 * (c - h), 100 * (c + h)] as const;
}
export function line(tag: string, games: any[], seats = 2) {
  const n = games.length;
  const ids = ["P1", "P2", "P3", "P4"].slice(0, seats);
  const w = ids.map((p) => games.filter((g) => g.winner === p).length);
  const nul = n - w.reduce((a, b) => a + b, 0);
  const ends: Record<string, number> = {};
  for (const g of games) ends[g.by] = (ends[g.by] ?? 0) + 1;
  const rounds = games.map((g) => g.rounds).sort((a: number, b: number) => a - b);
  const parts = ids.map((p, i) => {
    const [lo, hi] = wilson(w[i], n);
    return `${p} ${(100 * w[i] / n).toFixed(1)}%[${lo.toFixed(1)}-${hi.toFixed(1)}]`;
  });
  console.log(
    `${tag.padEnd(32)} n=${n}  ${parts.join("  ")}  none ${nul}` +
    `  | rounds med ${rounds[Math.floor(n / 2)]} mean ${(rounds.reduce((a: number, b: number) => a + b, 0) / n).toFixed(2)}` +
    `  | ${Object.entries(ends).map(([k, v]) => `${k}:${v}`).join(" ")}`,
  );
}
