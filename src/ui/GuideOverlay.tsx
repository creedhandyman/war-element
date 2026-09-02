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

/** THE TEACHER IS THE PLAYER'S OWN FIRST CARD.
 *
 *  `STARTER_DECK` is one id and it is Sakuroot's, so on a brand-new save this is
 *  a portrait of the only card they own — which is the point. A disembodied
 *  "GETTING STARTED" tag teaches from nowhere; a face that is also sitting in
 *  their squad, and that they are about to walk into the first fight with, makes
 *  the tutorial part of the world rather than chrome laid over it.
 *
 *  A SEPARATE ASSET from `cards/leaf_sakuroot.webp`, deliberately: the card art
 *  in a fight is not changing, and a portrait cropped to read at 46px is the
 *  wrong picture for a card face anyway. */
const TEACHER_ART = "/teacher-sakuroot.webp";
const TEACHER_NAME = "Sakuroot";

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
