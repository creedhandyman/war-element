/** THE EFFECTS LAYER IN A WORKER — the page's end of it.
 *
 *  Makes the canvas (the same `.vfx-layer` element the layer makes for itself
 *  on the page), hands its drawing to vfx-worker.ts, and stands in for the
 *  layer: every call is a message, and none of them waits for an answer. The
 *  one thing the page asks synchronously — how a signature move plays — is a
 *  table the worker sends once, when it is ready.
 *
 *  Any failure to start REJECTS, and use-spell-impacts.ts falls back to the
 *  layer on the page's own thread: a phone that cannot draw from a worker
 *  still gets every effect, the old way. Import no Pixi here — this module is
 *  on the page, and the worker brings its own. */
import type { ImpactLayer } from "./impact-layer";
import { layerResolution, type FromWorker, type SignatureMeta, type ToWorker } from "./worker-protocol";

/** A worker that has not said it is ready by now is not going to be. Starting
 *  loads Pixi's renderer, so on a slow connection this is seconds, not frames. */
const READY_WITHIN_MS = 10_000;

export function createWorkerLayer(): Promise<ImpactLayer> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.className = "vfx-layer";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.visibility = "hidden"; // idle until the worker says it drew
    document.body.appendChild(canvas);

    let worker: Worker;
    try {
      worker = new Worker(new URL("./vfx-worker.ts", import.meta.url), { type: "module" });
    } catch (err) {
      canvas.remove();
      reject(err);
      return;
    }
    const post = (m: ToWorker, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
    const onResize = () => post({ t: "resize", width: window.innerWidth, height: window.innerHeight });
    let started = false;
    const fail = (why: unknown) => {
      if (started) {
        // After a good start, a crash only loses the effects; the game plays on.
        console.warn("[vfx] effects worker stopped:", why);
        return;
      }
      started = true;
      clearTimeout(timer);
      worker.terminate();
      canvas.remove();
      reject(why instanceof Error ? why : new Error(String(why)));
    };
    const timer = setTimeout(() => fail("the effects worker did not start"), READY_WITHIN_MS);
    worker.onerror = (e) => fail(e.message || "effects worker error");
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.t === "vis") {
        canvas.style.visibility = m.visible ? "visible" : "hidden";
      } else if (m.t === "fail") {
        fail(m.reason);
      } else if (m.t === "ready" && !started) {
        started = true;
        clearTimeout(timer);
        const signatures: Record<string, SignatureMeta> = m.signatures;
        window.addEventListener("resize", onResize);
        resolve({
          impact: (x, y, element, strength, variant) => post({ t: "impact", x, y, element, strength, variant }),
          play: (fx) => post({ t: "play", fx }),
          // Counters the lab reads; the game never does, and asking a worker is not free.
          get live() { return 0; },
          get quality() { return 1; },
          fps: () => 0,
          setCap: (n) => post({ t: "cap", n }),
          signature: (key) => signatures[key] ?? null,
          destroy: () => {
            post({ t: "destroy" });
            window.removeEventListener("resize", onResize);
            canvas.remove();
          },
        });
      }
    };
    let offscreen: OffscreenCanvas;
    try {
      offscreen = canvas.transferControlToOffscreen();
    } catch (err) {
      fail(err);
      return;
    }
    post({
      t: "init", canvas: offscreen, width: window.innerWidth, height: window.innerHeight,
      resolution: layerResolution(window.devicePixelRatio),
    }, [offscreen]);
  });
}
