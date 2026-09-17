import { useEffect, useRef } from "react";
import { browserBackStack } from "./back-stack";

/** While `active`, the phone's back button closes this layer by calling `onBack`.
 *  A `sticky` layer is handed the press and stays open. See back-stack.ts.
 *
 *  `active` has to be the same condition that DRAWS the layer: one registered
 *  while nothing is showing takes a press that visibly does nothing. */
export function useBackLayer(active: boolean, onBack: () => void, sticky = false): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    return browserBackStack().open(() => latest.current(), sticky);
  }, [active, sticky]);
}
