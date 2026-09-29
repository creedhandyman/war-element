/** THE EFFECTS LAYER, OFF THE PAGE'S THREAD.
 *
 *  The same layer (impact-layer.ts) with the same looks and signatures, drawing
 *  into a canvas the page handed over (worker-layer.ts). Nothing about what is
 *  drawn changes; WHERE the work happens does.
 *
 *  WHY. Measured in a 7x7 battle with the CPU slowed to a phone's, the effects
 *  were 40-50% of the page's main-thread work per step — and most of that was
 *  not Pixi. A render loop on the page's thread makes the page produce a frame
 *  on every vsync for as long as anything is flying, and every such frame
 *  re-styles every running CSS animation on the board and repaints. From here
 *  the canvas's frames go to the compositor directly: the page only makes a
 *  frame when the page itself changes. */
import { DOMAdapter, WebWorkerAdapter } from "pixi.js";
import { createImpactLayer, type ImpactLayer } from "./impact-layer";
import { SIGNATURES } from "./signatures";
import type { FromWorker, ToWorker } from "./worker-protocol";

DOMAdapter.set(WebWorkerAdapter);

const scope = self as unknown as {
  postMessage(m: FromWorker): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  close(): void;
};
const post = (m: FromWorker) => scope.postMessage(m);

let layer: ImpactLayer | null = null;
/** Anything that arrives while the layer is still starting (a resize). */
const waiting: ToWorker[] = [];

function handle(m: ToWorker) {
  if (!layer) {
    waiting.push(m);
    return;
  }
  switch (m.t) {
    case "impact":
      layer.impact(m.x, m.y, m.element, m.strength, m.variant);
      break;
    case "play":
      layer.play(m.fx);
      break;
    case "resize":
      layer.resize?.(m.width, m.height);
      break;
    case "cap":
      layer.setCap(m.n);
      break;
    case "destroy":
      layer.destroy();
      scope.close();
      break;
  }
}

scope.onmessage = async (e) => {
  const m = e.data;
  if (m.t !== "init") {
    handle(m);
    return;
  }
  // The layer's clock is the frame clock. A worker without one (an older
  // Safari) cannot animate anything: say so, and the page draws instead.
  if (typeof requestAnimationFrame !== "function") {
    post({ t: "fail", reason: "no requestAnimationFrame in a worker" });
    return;
  }
  try {
    const l = await createImpactLayer({
      canvas: m.canvas, width: m.width, height: m.height, resolution: m.resolution,
      setVisible: (visible) => post({ t: "vis", visible }),
    });
    layer = l;
    const signatures = Object.fromEntries(Object.keys(SIGNATURES).map((k) => [k, l.signature(k)!]));
    post({ t: "ready", signatures });
    for (const w of waiting.splice(0)) handle(w);
  } catch (err) {
    post({ t: "fail", reason: String(err) });
  }
};
