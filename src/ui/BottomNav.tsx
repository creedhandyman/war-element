/** The places you can be when you are not in a match.
 *
 *  War Element's front end was one screen: a title, a mode toggle, two deck
 *  pickers and a stack of ghost buttons, with Story Mode as one of those buttons
 *  and no home for a shop at all. That works while there are two things to do
 *  and stops working at four.
 *
 *  Deliberately hidden DURING a match. A bottom bar over a 5x5 board on a phone
 *  eats the row the player needs most, and there is nowhere to navigate to
 *  mid-fight anyway — Surrender is the exit and it already exists.
 */
import { Home, Swords, Map, Store, Landmark } from "lucide-react";

export type Tab = "home" | "arena" | "story" | "tower" | "shop";

/** Order is the order they sit in the bar. Home is not first: it is second-left,
 *  because the thumb rests near the middle on a phone and Home is the one you
 *  reach for by reflex. */
const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: "arena", label: "Arena", Icon: Swords },
  { id: "home", label: "Home", Icon: Home },
  { id: "story", label: "Story", Icon: Map },
  { id: "tower", label: "Tower", Icon: Landmark },
  { id: "shop", label: "Shop", Icon: Store },
];

export function BottomNav(props: {
  tab: Tab;
  onTab: (t: Tab) => void;
  /** Unspent essence, summed. Shows as a dot on Shop so the player learns the
   *  currency exists without a tutorial — it is earned in Story and spent here,
   *  and nothing else in the UI connects those two places. */
  spendable?: number;
}) {
  return (
    <nav className="bnav" aria-label="Main">
      {TABS.map(({ id, label, Icon }) => {
        const on = props.tab === id;
        return (
          <button
            key={id}
            className={`bnav-btn ${on ? "on" : ""}`}
            aria-current={on ? "page" : undefined}
            onClick={() => props.onTab(id)}
          >
            <span className="bnav-ico">
              <Icon size={22} strokeWidth={on ? 2.4 : 1.9} aria-hidden="true" />
              {id === "shop" && (props.spendable ?? 0) > 0 && <i className="bnav-dot" />}
            </span>
            <span className="bnav-lbl">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
