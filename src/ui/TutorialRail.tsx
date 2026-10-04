/** THE FORCED-PLAY OVERLAY for the first battle (beats in ui/tutorial.ts).
 *
 *  Everything is dimmed and swallows taps except a hole over the one thing to
 *  tap, which pulses. One large instruction says what to do with it, and an
 *  optional small line under it says why. While the player cannot act (the
 *  enemy's turn, the board resolving) the whole screen is held and the line
 *  says what is happening instead.
 *
 *  The target is found in the DOM by what the match already renders — a hand
 *  card's `data-def`, a square's `data-pos`, the Pass button, an action-ring
 *  verb's `data-verb` — and re-measured every frame, because the hand fans, the
 *  board animates and the action ring moves with the acting card.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import type { Beat, TutorialDef, TutTarget } from "./tutorial";

type Rect = { x: number; y: number; w: number; h: number };

function selectorFor(t: TutTarget): string {
  switch (t.kind) {
    case "hand": return `.hand .hcard[data-def="${t.defId}"]`;
    case "slot": return `.board [data-pos="${t.row},${t.col}"]`;
    case "pass": return ".pass-btn";
    case "verb": return `.wheel-verb[data-verb="${t.verb}"]`;
    case "spellbook": return ".spellbook-toggle";
    case "spell": return `.spellchip[data-spell="${t.spellId}"]:not(.used)`;
  }
}

const PAD = 6;

/** The first element matching `sel` that is actually on screen and enabled.
 *  Several can match: the spellbook is mounted in the desktop rail and in the
 *  phone's action panel at once, one of them hidden by CSS. */
function visibleRect(sel: string): Rect | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || (el as HTMLButtonElement).disabled) continue;
    return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
  }
  return null;
}

/** Where the target is right now, padded a little — or, while it is not on
 *  screen, where the beat's `pre` target is (`usedPre`). Null while neither
 *  is (the ring has not opened yet, the hand is still dealing). */
function useTargetRect(beat: Beat | null): { rect: Rect | null; usedPre: boolean } {
  const [found, setFound] = useState<{ rect: Rect | null; usedPre: boolean }>({ rect: null, usedPre: false });
  useLayoutEffect(() => {
    if (!beat) { setFound({ rect: null, usedPre: false }); return; }
    const main = selectorFor(beat.target);
    const pre = beat.pre ? selectorFor(beat.pre.target) : null;
    let raf = 0;
    let last = "";
    const tick = () => {
      let rect = visibleRect(main);
      let usedPre = false;
      if (!rect && pre) { rect = visibleRect(pre); usedPre = !!rect; }
      const key = rect ? `${usedPre}:${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)},${Math.round(rect.h)}` : "none";
      if (key !== last) { last = key; setFound({ rect, usedPre }); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [beat]);
  return found;
}

export function TutorialRail(props: {
  beat: Beat | null;
  /** May the player act on `beat` right now? */
  actionable: boolean;
  onSkip: () => void;
}) {
  const { beat, actionable } = props;
  const { rect, usedPre } = useTargetRect(beat && actionable ? beat : null);
  const [askSkip, setAskSkip] = useState(false);
  useEffect(() => setAskSkip(false), [beat?.id]);

  const live = !!(beat && actionable && rect);
  // The `pre` step speaks for itself while its target is the one on screen.
  const say = beat && usedPre && beat.pre ? beat.pre : beat;
  const big = beat ? (actionable ? say!.big : beat.wait ?? "Watch the board.") : "";
  const small = beat && actionable ? say!.small : undefined;
  // The line sits away from what it points at: low when the target is in the
  // top half of the screen, high otherwise.
  const low = live && rect!.y + rect!.h / 2 < window.innerHeight / 2;

  return (
    <div className={`tut-rail${live ? " live" : " hold"}`} aria-live="polite">
      {live ? (
        <>
          <div className="tut-dim" style={{ left: 0, top: 0, width: "100%", height: Math.max(0, rect!.y) }} />
          <div className="tut-dim" style={{ left: 0, top: rect!.y + rect!.h, width: "100%", bottom: 0 }} />
          <div className="tut-dim" style={{ left: 0, top: rect!.y, width: Math.max(0, rect!.x), height: rect!.h }} />
          <div className="tut-dim" style={{ left: rect!.x + rect!.w, top: rect!.y, right: 0, height: rect!.h }} />
          <div className="tut-ring" style={{ left: rect!.x, top: rect!.y, width: rect!.w, height: rect!.h }} aria-hidden="true" />
        </>
      ) : (
        <div className="tut-dim tut-hold" />
      )}

      {big && (
        <div className={`tut-say${low ? " low" : ""}`} role="status">
          <b>{big}</b>
          {small && <span>{small}</span>}
        </div>
      )}

      <div className="tut-rail-skip">
        {askSkip ? (
          <>
            <span>Skip the tutorial?</span>
            <button className="ghost sm" onClick={props.onSkip}>Skip</button>
            <button className="ghost sm" onClick={() => setAskSkip(false)}>Keep going</button>
          </>
        ) : (
          <button className="ghost sm" onClick={() => setAskSkip(true)}>Skip tutorial</button>
        )}
      </div>
    </div>
  );
}

/** The result of a scripted battle, in place of the ordinary win screen. */
export function TutorialDone(props: { def: TutorialDef; firstRun: boolean; onContinue: () => void }) {
  const { result } = props.def;
  return (
    <div className="overlay on-top">
      <div className="modal tut-done">
        <div className="win-title win">VICTORY</div>
        <p className="tut-done-lead">{result.lead}</p>
        <ul className="tut-done-list">
          {result.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <button className="lockin" onClick={props.onContinue}>
          {props.firstRun ? "Open your free pack" : "Back to the Training Ground"}
        </button>
      </div>
    </div>
  );
}

/** THE FIRST THING A NEW PLAYER SEES: the title and one button. Everything else
 *  (Home, the story, the shop) waits until they have played. The small link is
 *  for someone who has played before. */
export function FirstRun(props: { onPlay: () => void; onSkip: () => void }) {
  return (
    <div className="first-run">
      <img className="first-run-art" src="/title.webp" alt="War Element" draggable={false} />
      <div className="first-run-go">
        <button className="lockin first-run-play" onClick={props.onPlay}>Play</button>
        <button className="first-run-skip" onClick={props.onSkip}>I've played before. Skip the tutorial.</button>
      </div>
    </div>
  );
}
