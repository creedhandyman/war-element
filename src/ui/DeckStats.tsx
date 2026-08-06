/** Live composition of a deck being built: elements, classes, and the cost
 *  curve, plus the average cost.
 *
 *  Extracted from DeckBuilder so the Story Mode collection shows the SAME
 *  readout while you add cards there. Duplicating the markup would have meant
 *  two cost curves that drift apart, and the campaign is the place the numbers
 *  matter most — you are building against one known enemy formation.
 */
import { useMemo } from "react";
import type { CardClass, Element } from "../engine";
import { getDef } from "../engine";
import { EL_COLOR } from "./shared";

const ELEMENTS: Element[] = ["LEAF", "PYRO", "AQUA", "DAWN", "GALE", "BOLT", "DUSK", "BORE"];
const CLASSES: CardClass[] = ["Assassin", "Warrior", "Tank", "Ranger", "Mage", "Support"];

export interface DeckComposition {
  byElement: Record<string, number>;
  byClass: Record<string, number>;
  byCost: Record<number, number>;
  maxCostCount: number;
  avg: number;
}

/** Count a deck up. Pure, so both callers can memoise it themselves. */
export function composition(cards: readonly string[]): DeckComposition {
  const byElement: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  const byCost: Record<number, number> = {};
  let costSum = 0;
  for (const id of cards) {
    const d = getDef(id);
    byElement[d.element] = (byElement[d.element] ?? 0) + 1;
    byClass[d.cardClass] = (byClass[d.cardClass] ?? 0) + 1;
    byCost[d.cost] = (byCost[d.cost] ?? 0) + 1;
    costSum += d.cost;
  }
  return {
    byElement,
    byClass,
    byCost,
    maxCostCount: Math.max(1, ...Object.values(byCost)),
    avg: cards.length ? costSum / cards.length : 0,
  };
}

export function useComposition(cards: readonly string[]): DeckComposition {
  return useMemo(() => composition(cards), [cards]);
}

/** The three blocks. `compact` drops the class row, which is the least useful of
 *  the three in a narrow rail. */
export function DeckStats({ stats, compact }: { stats: DeckComposition; compact?: boolean }) {
  return (
    <div className="db-stats db-panel">
      <div className="dbs-block">
        <div className="dbs-lbl">Elements</div>
        <div className="dbs-tags">
          {ELEMENTS.filter((el) => stats.byElement[el]).map((el) => (
            <span key={el} className="dbs-tag" style={{ borderColor: EL_COLOR[el] }}>
              <span className="dbs-dot" style={{ background: EL_COLOR[el] }} />
              {el} {stats.byElement[el]}
            </span>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="dbs-block">
          <div className="dbs-lbl">Classes</div>
          <div className="dbs-tags">
            {CLASSES.filter((c) => stats.byClass[c]).map((c) => (
              <span key={c} className="dbs-tag">{c} {stats.byClass[c]}</span>
            ))}
          </div>
        </div>
      )}
      <div className="dbs-block">
        <div className="dbs-lbl">Cost curve · avg {stats.avg.toFixed(1)}</div>
        <div className="dbs-curve">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((cost) => {
            const n = stats.byCost[cost] ?? 0;
            return (
              <div key={cost} className="dbs-col" title={`Cost ${cost}: ${n}`}>
                <div className="dbs-bar-wrap">
                  {n > 0 && (
                    <div className="dbs-bar" style={{ height: `${(n / stats.maxCostCount) * 100}%` }}>
                      <span className="dbs-barnum">{n}</span>
                    </div>
                  )}
                </div>
                <div className="dbs-cost">{cost}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
