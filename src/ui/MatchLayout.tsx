/** The match screen's shell: the frame, the strips and the drawers.
 *
 *  Migration step 7 of the mobile redesign. This owns the scaffolding that
 *  surrounds a match and nothing that decides one — the `.wrap` element and
 *  its modifier classes, the music toggle, the battle-log rail, the two edge
 *  tabs that open the phone drawers, and the Spells bottom sheet. Everything
 *  with a rule in it (the board, the right column, the action bar, the hand,
 *  every overlay) arrives as a slot, already rendered by App.
 *
 *  State stays exactly where it is. This component holds none: the drawer it
 *  opens, the rail it collapses and the track it mutes are all App's, passed
 *  in with their setters. That is deliberate — the point of the extraction is
 *  that the layout stops being 130 lines in the middle of a 2,400-line render
 *  and becomes a thing with a name and a readable prop list, NOT that state
 *  moves. Moving state is the next step and it does not depend on this one.
 *
 *  Desktop is untouched by construction: the strips and drawers are the same
 *  markup they always were and every tier difference is still CSS. `.rail`
 *  is a full-height column on a wide screen and a one-line strip under the
 *  board on a phone; `.edge-tab` and `.mobile-sheet` are display:none outside
 *  the compact query. Nothing here asks which tier it is on.
 */
import type { ReactNode } from "react";

export type MobilePanel = "log" | "spells" | null;

export function MatchLayout(props: {
  /** `.wrap` modifiers. Kept as three booleans rather than a className string
   *  so a caller cannot quietly invent a fourth state the CSS has never seen. */
  logCollapsed: boolean;
  preMatch: boolean;
  wheelUp: boolean;

  /** Which phone drawer is open, and how to change it. */
  mobilePanel: MobilePanel;
  setMobilePanel: (p: MobilePanel) => void;
  /** True when the log is rendering as the phone's one-line strip — then the
   *  whole rail is a tap target that raises it. On desktop this is false and
   *  the handlers below are never attached. */
  logIsStrip: boolean;
  onToggleLogRail: () => void;

  musicMuted: boolean;
  onToggleMusic: () => void;

  /** Slots, in render order. */
  ribbon: ReactNode;
  /** The rows inside `.loglist`. The container is the shell's; the rows are
   *  App's, because condensing and labelling them is match logic. */
  logEntries: ReactNode;
  board: ReactNode;
  rightCol: ReactNode;
  /** The Spells sheet's body — the tray during prep, a note otherwise. */
  spellSheet: ReactNode;
  bottom: ReactNode;
  /** Everything else App renders inside `.wrap`: the hand, the modals, and the
   *  other screens, which are siblings of the match rather than children of
   *  it. Passing them through keeps `.wrap` a single element. */
  children?: ReactNode;
}) {
  const { mobilePanel, setMobilePanel, logIsStrip } = props;

  return (
    // Hidden by class rather than unmounted before a match: things that measure
    // the board on mount would otherwise have to learn a new lifecycle.
    <div
      className={
        "wrap" +
        (props.logCollapsed ? " log-collapsed" : "") +
        (props.preMatch ? " pre-match" : "") +
        (props.wheelUp ? " wheel-up" : "")
      }
    >
      <button
        className="music-toggle"
        onClick={props.onToggleMusic}
        title={props.musicMuted ? "Unmute music" : "Mute music"}
        aria-label={props.musicMuted ? "Unmute music" : "Mute music"}
      >
        {props.musicMuted ? "🔇" : "🔊"}
      </button>

      {props.ribbon}

      {/* On a phone this is a ONE-LINE strip under the board, and tapping it
          raises the full rail — which is why the whole thing is a tap target
          rather than the edge tab it replaces. Guarded on the drawer being
          shut so a tap inside the open rail (selecting text, hitting ✕)
          cannot re-open it. On desktop the rail is always full height and the
          handler is inert: .mobile-open only means anything inside the
          portrait query. */}
      <div
        className={
          "rail log-rail" +
          (props.logCollapsed ? " collapsed" : "") +
          (mobilePanel === "log" ? " mobile-open" : "")
        }
        role={logIsStrip ? "button" : undefined}
        tabIndex={logIsStrip ? 0 : undefined}
        aria-label={logIsStrip ? "Battle log — open the full rail" : undefined}
        onClick={logIsStrip ? () => setMobilePanel("log") : undefined}
        onKeyDown={
          logIsStrip
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setMobilePanel("log");
                }
              }
            : undefined
        }
      >
        <button
          className="rail-collapse"
          onClick={props.onToggleLogRail}
          title={props.logCollapsed ? "Show battle log" : "Collapse battle log"}
          aria-label={props.logCollapsed ? "Show battle log" : "Collapse battle log"}
        >
          {props.logCollapsed ? "☰" : "«"}
        </button>
        <div className="rail-title">
          Battle Log
          <button className="panel-close" onClick={() => setMobilePanel(null)} aria-label="Close">✕</button>
        </div>
        <div className="loglist">{props.logEntries}</div>
      </div>

      {/* Mobile-only edge tabs — open the Log (left) / Spells (right) overlays. */}
      <button className="edge-tab left" onClick={() => setMobilePanel(mobilePanel === "log" ? null : "log")}>
        <span>LOG</span>
      </button>
      <button className="edge-tab right" onClick={() => setMobilePanel(mobilePanel === "spells" ? null : "spells")}>
        <span>SPELLS</span>
      </button>

      {props.board}
      {props.rightCol}

      {/* Mobile: the Spells tab opens the tray as a bottom sheet. */}
      {mobilePanel === "spells" && (
        <div className="mobile-sheet" onClick={() => setMobilePanel(null)}>
          <div className="mobile-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="rail-title">
              Spells
              <button className="panel-close" onClick={() => setMobilePanel(null)} aria-label="Close">✕</button>
            </div>
            {props.spellSheet}
          </div>
        </div>
      )}

      {props.bottom}
      {props.children}
    </div>
  );
}
