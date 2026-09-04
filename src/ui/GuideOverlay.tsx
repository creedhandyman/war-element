/** THE GUIDED WALKTHROUGH — a coach-mark that points at the real control.
 *
 *  The first-run guide used to be a card at the top of Home with the next step
 *  written on it. That is a fine checklist and a poor walkthrough: it told a new
 *  player what to do and left them to find the thing to do it with, on a screen
 *  with five tabs, a purse, a live band and a shop. "Open your free pack" is
 *  only useful next to the pack.
 *
 *  So this dims the screen, cuts a hole around the actual element, rings it, and
 *  puts the sentence beside it. The step still comes from `Onboarding.tsx` and is
 *  still DERIVED from the save, so this is a presentation layer over a model
 *  that already worked rather than a second source of truth about progress.
 *
 *  IT DOES NOT BLOCK INPUT. Every dim panel is `pointer-events: none`, so the
 *  player can tap anything on the screen at any time, including things the guide
 *  is not pointing at. That is deliberate and it is the same stance
 *  `TutorialCoach` takes: this game's first node is a designed teaching fight
 *  rather than a rail, and a tutorial that seizes the controls is teaching a
 *  different game than the one being played. What changes here is only that the
 *  instruction now has an address.
 *
 *  THE HOLE IS MEASURED, NOT GUESSED. Targets are marked with `data-guide="id"`
 *  in whichever component owns them, so the guide never encodes another file's
 *  layout — it asks the DOM where the thing currently is. A target that is not
 *  on screen (wrong tab, not rendered yet, renamed) degrades to a centred card
 *  with no spotlight, which is exactly the old behaviour and never a blank
 *  screen.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TEACHER_ART, TEACHER_NAME } from "./shared";

/** A measured target: viewport coordinates, or null when we cannot find it. */
interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Breathing room around the target, in px. A ring drawn ON the element's edge
 *  reads as a border the element grew rather than as an annotation about it. */
const PAD = 8;



/** IS SOMETHING MORE IMPORTANT ON SCREEN?
 *
 *  A surface marked `data-guide-suppress` owns the screen while it is up and the
 *  walkthrough gets out of the way. The pack reveal is the case this was written
 *  for: the step says "open your free pack", the player does, and the guide
 *  advanced to the NEXT step and planted its card on top of the card they had
 *  just pulled — covering both the art and the button to dismiss it.
 *
 *  Asked of the DOM rather than threaded through props, for the same reason the
 *  hole is: the guide already refuses to encode another component's layout, and
 *  a surface that wants the screen can say so where it is rendered instead of
 *  App having to learn about every modal in the app.
 */
function useSuppressed(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const look = () => setHidden(!!document.querySelector("[data-guide-suppress]"));
    look();
    const mo = new MutationObserver(look);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return hidden;
}

export function guideTarget(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-guide="${CSS.escape(id)}"]`);
}

/** Measure `id` now, and keep measuring it while it can move.
 *
 *  Everything that changes a rect fires here: scroll (capture-phase, so inner
 *  scrollers count too), resize, and the element's own size via ResizeObserver.
 *  There is also a short rAF poll on mount, because a step usually arrives at the
 *  same moment as the tab it points into — the target's first rect is measured
 *  mid-transition, and without a second look the hole sits where the element was
 *  passing through rather than where it came to rest.
 */
function useHole(id: string | null): Hole | null {
  const [hole, setHole] = useState<Hole | null>(null);
  const raf = useRef(0);

  useLayoutEffect(() => {
    if (!id) { setHole(null); return; }
    let alive = true;
    let settle = 0;

    const measure = () => {
      if (!alive) return;
      const el = guideTarget(id);
      if (!el) { setHole(null); return; }
      const r = el.getBoundingClientRect();
      // A zero-size rect is an element that is in the tree but not laid out —
      // display:none, or a tab mid-transition. Treat it as "not found" so the
      // guide shows its centred fallback instead of a spotlight on a dot.
      if (r.width < 1 || r.height < 1) { setHole(null); return; }
      setHole((prev) =>
        prev && prev.top === r.top && prev.left === r.left
          && prev.width === r.width && prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    // ~600ms of settling, which covers a tab change and any CSS transition on
    // it. Cheap: one getBoundingClientRect a frame, and it stops on its own.
    const poll = () => {
      settle += 1;
      measure();
      if (settle < 36) raf.current = requestAnimationFrame(poll);
    };
    raf.current = requestAnimationFrame(poll);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const el = guideTarget(id);
    if (ro && el) ro.observe(el);

    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      ro?.disconnect();
    };
  }, [id]);

  return hole;
}

export function GuideOverlay(props: {
  /** `data-guide` value to spotlight, or null for a centred card. */
  anchor: string | null;
  title: string;
  body: string;
  /** The button that DOES the thing — takes you there, never merely points. */
  cta: string;
  onCta: () => void;
  /** Absent = this step cannot be skipped yet. The guide is mandatory through
   *  the first pack and the first fight; after that this is a function. */
  onSkip?: () => void;
  /** Why Skip is not there yet, shown in its place. A missing button with no
   *  explanation reads as a broken screen. */
  skipLockedNote?: string;
  stepIndex: number;
  stepCount: number;
}) {
  const hole = useHole(props.anchor);
  const suppressed = useSuppressed();

  /** BRING THE TARGET SOMEWHERE THE CARD FITS.
   *
   *  The bubble goes below its target, or above when there is no room below.
   *  Both are correct and both can still land on top of something worth seeing:
   *  the Shop's pack button sits near the bottom of its panel, so the card went
   *  ABOVE it and covered the pack art and its "5 card booster pack" label — the
   *  product the step is telling you to open.
   *
   *  Scrolling the target to the MIDDLE fixes it at the cause rather than
   *  nudging the card around: from there the room below is real, the bubble
   *  takes the ordinary below-placement, and what is above the target stays
   *  visible. `useHole` already re-measures on scroll (capture phase), so the
   *  ring follows on its own.
   *
   *  Keyed on the anchor id, so it happens once per step and not on every
   *  re-measure — a scroll that re-ran on its own result would fight the player. */
  useEffect(() => {
    if (!props.anchor || suppressed) return;
    const el = guideTarget(props.anchor);
    if (!el) return;
    const id = window.setTimeout(
      () => el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" }),
      // After the tab switch this step may have just triggered, or it scrolls
      // the outgoing screen.
      160,
    );
    return () => window.clearTimeout(id);
  }, [props.anchor, suppressed]);
  /** MINIMISED, not skipped. The core steps deliberately cannot be skipped until
   *  the first pack and the first battle are done, and that rule is worth
   *  keeping — but "you may not dismiss this" and "this sits on top of the thing
   *  it is describing" are two different promises, and only the first one was
   *  intended. Collapsing leaves the step live, the pips visible and the CTA one
   *  tap away, while giving the screen back.
   *
   *  Resets whenever the STEP changes: a new instruction has not been read yet,
   *  so it earns one showing. */
  const [minimised, setMinimised] = useState(false);
  useEffect(() => { setMinimised(false); }, [props.title]);
  const [bubble, setBubble] = useState<HTMLDivElement | null>(null);
  const [above, setAbove] = useState(false);

  // Below the target if it fits, above it if it does not. Measured against the
  // bubble's real height rather than an assumed one, because these bodies are
  // two lines on a phone and one on a desktop.
  useEffect(() => {
    if (!hole || !bubble) { setAbove(false); return; }
    const h = bubble.getBoundingClientRect().height;
    const roomBelow = window.innerHeight - (hole.top + hole.height + PAD);
    setAbove(roomBelow < h + 24 && hole.top > h + 24);
  }, [hole, bubble]);

  const ring = hole
    ? {
      top: hole.top - PAD,
      left: hole.left - PAD,
      width: hole.width + PAD * 2,
      height: hole.height + PAD * 2,
    }
    : null;

  // A surface that owns the screen has said so. Hooks all ran first, so this
  // early return cannot change their order between renders.
  if (suppressed) return null;

  if (minimised) {
    return (
      <div className="gd-wrap" role="dialog" aria-label="Getting started">
        <button className="gd-mini" onClick={() => setMinimised(false)}
          title="Show the walkthrough again">
          <img src={TEACHER_ART} alt="" draggable={false}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <b>{props.title}</b>
          <i aria-hidden="true">▲</i>
        </button>
      </div>
    );
  }

  return (
    <div className="gd-wrap" role="dialog" aria-label="Getting started" aria-live="polite">
      {/* FOUR PANELS, NOT A MASK. An SVG mask or a giant box-shadow would dim
          just as well, but both cover the hole with a transparent surface that
          still eats the tap. Four rectangles leave the target genuinely
          uncovered — and every one of them is pointer-events:none anyway, so
          the rest of the screen stays live too. */}
      {ring ? (
        <>
          <div className="gd-dim" style={{ top: 0, left: 0, right: 0, height: Math.max(0, ring.top) }} />
          <div className="gd-dim" style={{ top: ring.top, left: 0, width: Math.max(0, ring.left), height: ring.height }} />
          <div className="gd-dim" style={{ top: ring.top, left: ring.left + ring.width, right: 0, height: ring.height }} />
          <div className="gd-dim" style={{ top: ring.top + ring.height, left: 0, right: 0, bottom: 0 }} />
          <div className="gd-ring" style={{ top: ring.top, left: ring.left, width: ring.width, height: ring.height }} />
        </>
      ) : (
        <div className="gd-dim gd-dim-all" />
      )}

      <div
        ref={setBubble}
        className={`gd-tip ${ring ? (above ? "gd-above" : "gd-below") : "gd-mid"}`}
        style={ring
          ? {
            top: above ? undefined : ring.top + ring.height + 12,
            bottom: above ? window.innerHeight - ring.top + 12 : undefined,
            // Centred on the target, then clamped so it never leaves the
            // viewport on a phone where the target is near an edge.
            left: Math.max(12, Math.min(window.innerWidth - 12 - 320, ring.left + ring.width / 2 - 160)),
          }
          : undefined}
      >
        <div className="gd-head">
          <img className="gd-face" src={TEACHER_ART} alt="" draggable={false}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <span className="gd-who">
            <b>{TEACHER_NAME}</b>
            <i>your first card</i>
          </span>
          <button className="gd-min" onClick={() => setMinimised(true)}
            title="Tuck this away — it stays on this step" aria-label="Minimise">▾</button>
          <span className="gd-pips" aria-label={`Step ${props.stepIndex + 1} of ${props.stepCount}`}>
            {Array.from({ length: props.stepCount }, (_, n) => (
              <i key={n} className={n < props.stepIndex ? "done" : n === props.stepIndex ? "on" : ""} aria-hidden="true" />
            ))}
          </span>
        </div>
        <div className="gd-title">{props.title}</div>
        <p className="gd-body">{props.body}</p>
        <div className="gd-actions">
          <button className="lockin gd-go" onClick={props.onCta}>{props.cta}</button>
          {props.onSkip
            ? (
              <button className="gd-skip" onClick={props.onSkip} title="Hide this — How to play is always in the menu">
                Skip the rest
              </button>
            )
            : props.skipLockedNote
              ? <span className="gd-locked">{props.skipLockedNote}</span>
              : null}
        </div>
      </div>
    </div>
  );
}
