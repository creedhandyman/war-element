/** What the page and the effects worker say to each other (worker-layer.ts on
 *  the page, vfx-worker.ts in the worker).
 *
 *  Kept free of Pixi on purpose: the page imports this to decide whether to
 *  start a worker at all, and that decision must not pull the effects chunk
 *  into the main bundle. */
import type { Element } from "../../engine";
import type { LayerFx } from "./impact-layer";
import type { LookVariant } from "./looks/types";

/** The layer's pixel density: 2x is the ceiling on purpose — a 3x phone would
 *  triple the pixels a full-screen canvas fills for sparks that are soft-edged
 *  anyway. One rule for both places the layer can run. */
export const layerResolution = (devicePixelRatio: number) => Math.min(devicePixelRatio || 1, 2);

/** How a signature move plays on the page's side: board shake and the lunge.
 *  The page asks synchronously, so the worker sends the whole table once. */
export type SignatureMeta = { shake: number; lunge: boolean };

export type ToWorker =
  | { t: "init"; canvas: OffscreenCanvas; width: number; height: number; resolution: number }
  | { t: "impact"; x: number; y: number; element: Element; strength?: number; variant?: LookVariant }
  | { t: "play"; fx: LayerFx }
  | { t: "resize"; width: number; height: number }
  | { t: "cap"; n: number }
  | { t: "destroy" };

export type FromWorker =
  | { t: "ready"; signatures: Record<string, SignatureMeta> }
  | { t: "fail"; reason: string }
  | { t: "vis"; visible: boolean };

/** Can this browser draw the effects off the page's thread? It needs a worker,
 *  and a canvas the page can hand to one. (A worker that has them but no frame
 *  clock — an older Safari — says so itself, and the page falls back.)
 *
 *  `?vfx=page` in the address, or `we_vfx_page` = "1" in storage, keeps the
 *  effects on the page's thread: the way back if a device ever draws them
 *  wrong from a worker. */
export function workerLayerSupported(): boolean {
  try {
    if (new URLSearchParams(location.search).get("vfx") === "page") return false;
    if (localStorage.getItem("we_vfx_page") === "1") return false;
  } catch {
    // Storage unavailable (private mode, blocked): no override, decide below.
  }
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" && "transferControlToOffscreen" in HTMLCanvasElement.prototype;
}
