import { writeFileSync } from "fs";
import { CARDS } from "../data/cards";
const arg = (k: string, d: string) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=").slice(1).join("=") : d; };
const out = CARDS.map((c) => ({
  id: c.id, name: c.name, cost: c.cost, element: c.element, rarity: c.rarity, cls: c.cardClass,
  attackType: c.attackType, hp: c.hp, dmg: c.dmg, hits: c.hits, sp: c.sp, shields: c.shields,
  keywords: Object.keys(c.keywords ?? {}),
  handler: c.special?.handler ?? null, spCost: c.special?.cost ?? null,
  spParams: c.special?.params ?? null,
  onSummon: c.onSummon?.handler ?? null, onSummonParams: c.onSummon?.params ?? null,
  aura: (c as any).aura ?? null, tribe: (c as any).tribe ?? null,
  talent: (c as any).talent?.handler ?? null,
}));
writeFileSync(arg("out", "meta.json"), JSON.stringify(out));
console.log("wrote", out.length);
