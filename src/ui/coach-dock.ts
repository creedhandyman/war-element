import { useLayoutEffect, useState } from "react";

/** Where a floating coach card can sit without covering the hand or the phase
 *  ribbon: measured gaps from the bottom and top edges. Shared by the Training
 *  Ground's lesson coach (LessonCoach.tsx) and the struggle tips
 *  (StruggleTip.tsx).
 *  `deps` re-measures; pass whatever changes the furniture (step, phase, the
 *  acting card). */
export function useCoachDock(deps: unknown[]): { bottomGap: number; topGap: number } {
  /** HOW FAR UP THE BOTTOM EDGE ACTUALLY IS.
   *
   *  A bottom-docked card at `bottom: 8px` sits ON the hand, which is the whole
   *  complaint this is fixing — the coach was covering the exact cards the
   *  lesson was telling the player to play. Rather than hard-code a guess at the
   *  hand's height (it changes with the fan size, the phone, and the safe-area
   *  inset), measure the bottom furniture and dock above it.
   *
   *  Measured, not assumed, for the same reason `GuideOverlay` measures its
   *  anchors: this file must not carry a second copy of another component's
   *  layout. Nothing found — desktop, or a phase with no hand — leaves the
   *  offset at zero and the card sits at the ordinary bottom edge.
   */
  const [bottomGap, setBottomGap] = useState(0);
  /** The same question at the other end. `.tut-top` used to sit at a flat
   *  `top: 8px`, which put it over the phase ribbon — the round counter and the
   *  phase pills, i.e. the one place a player looks to find out what the game is
   *  waiting for. Measured for the same reason the bottom is: the ribbon's
   *  height changes across three media queries in styles.css, and a number
   *  copied out of one of them is wrong in the other two. */
  const [topGap, setTopGap] = useState(0);

  // Re-measured on every step and every phase, because the bottom furniture is
  // not the same in Deploy, Prep and Battle — which is also what makes the card
  // move as the player works rather than only when the lesson changes.
  useLayoutEffect(() => {
    // Everything that docks to the bottom of a fight. The highest top edge among
    // them is where the free screen ends. Hoisted out of `measure` because the
    // ResizeObserver below watches the same set.
    //
    // `.bottom` is in here now, and it is the one that mattered: it is the
    // action panel itself, and during Battle it grows and shrinks around every
    // card's turn. `.controls` lives INSIDE it, so measuring only the child
    // under-reports by whatever the panel puts above it.
    const sels = [".hand-float", ".hand-fan", ".bottom", ".controls", ".battle-log", ".log-rail"];
    const measure = () => {
      if (typeof document === "undefined") return;
      let highest = Infinity;
      for (const sel of sels) {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
          const r = el.getBoundingClientRect();
          // Only things actually sitting in the lower half: `.controls` is a
          // side column on desktop and must not push the card to mid-screen.
          if (r.height < 1) continue;
          if (r.top < window.innerHeight * 0.5) continue;
          highest = Math.min(highest, r.top);
        }
      }
      setBottomGap(Number.isFinite(highest) ? Math.max(0, window.innerHeight - highest + 8) : 0);

      // And the mirror of it. Only furniture in the UPPER half counts, and only
      // its BOTTOM edge — the ribbon is the thing to clear, not to align with.
      let lowest = 0;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(".phase-ribbon"))) {
        const r = el.getBoundingClientRect();
        if (r.height < 1) continue;
        if (r.bottom > window.innerHeight * 0.5) continue;
        lowest = Math.max(lowest, r.bottom);
      }
      setTopGap(lowest > 0 ? lowest + 8 : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    // AND WHENEVER THE FURNITURE ITSELF CHANGES SIZE. The step and the phase
    // are not enough: the whole Battle phase is one `game.phase`, and the
    // action panel resizes around every single card's turn inside it — which
    // is exactly when the last lesson (the Speed Queue one) is on screen.
    // Measured on the elements rather than guessed from state, the same way
    // `GuideOverlay.useHole` follows its target.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) for (const sel of sels)
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) ro.observe(el);
    return () => { window.removeEventListener("resize", measure); ro?.disconnect(); };
    // `awaitingInput` is the acting/not-acting flip, and it re-runs this so the
    // observer is re-attached to whatever the panel swapped in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { bottomGap, topGap };
}
