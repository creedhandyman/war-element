// THE EFFECTS DRAW FROM A WORKER, AND FALL BACK TO THE PAGE (owner report
// 2026-09-28: big boards "can't keep up"). Measured with the CPU slowed to a
// phone's, the effects layer's render loop on the page's own thread made the
// page produce a frame on every vsync for as long as anything was flying —
// each one re-styling every animation running on the board — and was 40-50%
// of the main thread's work in a 7x7 battle. The layer now draws from a worker
// (ui/vfx/worker-layer.ts, vfx-worker.ts), pixel for pixel the same.
//
// What must hold: a browser that cannot, or a worker that fails to start in
// any way, gets every effect on the page exactly as before; the page's half
// never pulls Pixi into the main bundle; and there is a way back
// (`?vfx=page`) if a device ever draws them wrong from a worker. The worker
// itself cannot run here, so its page-side half is driven against a fake one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkerLayer } from "../../ui/vfx/worker-layer";
import { layerResolution, workerLayerSupported, type FromWorker, type ToWorker } from "../../ui/vfx/worker-protocol";

const src = (f: string) => readFileSync(join(__dirname, "..", "..", f), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

class FakeCanvas {
  className = "";
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  removed = false;
  constructor(private readonly failTransfer: boolean) {}
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  remove() { this.removed = true; }
  transferControlToOffscreen() {
    if (this.failTransfer) throw new Error("the canvas already has a context");
    return { offscreen: true };
  }
}

class FakeWorker {
  static last: FakeWorker;
  posted: { m: ToWorker; transfer: unknown[] }[] = [];
  terminated = false;
  onmessage: ((e: { data: FromWorker }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  constructor(readonly url: URL, readonly opts: unknown) { FakeWorker.last = this; }
  postMessage(m: ToWorker, transfer: unknown[] = []) { this.posted.push({ m, transfer }); }
  terminate() { this.terminated = true; }
  say(m: FromWorker) { this.onmessage?.({ data: m }); }
}

/** A page for worker-layer.ts: a document to make the canvas in, a window to
 *  size it from, and the fake worker. */
function page({ failTransfer = false } = {}) {
  const canvases: FakeCanvas[] = [];
  const listeners: Record<string, () => void> = {};
  vi.stubGlobal("document", {
    createElement: () => {
      const c = new FakeCanvas(failTransfer);
      canvases.push(c);
      return c;
    },
    body: { appendChild: () => {} },
  });
  vi.stubGlobal("window", {
    innerWidth: 412, innerHeight: 915, devicePixelRatio: 2.625,
    addEventListener: (k: string, f: () => void) => { listeners[k] = f; },
    removeEventListener: (k: string) => { delete listeners[k]; },
  });
  vi.stubGlobal("Worker", FakeWorker);
  return { canvases, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the effects worker, from the page's side", () => {
  it("hands the worker the page's canvas at the page's size, and stands in for the layer", async () => {
    const env = page();
    const started = createWorkerLayer();
    const w = FakeWorker.last;
    expect(String(w.url)).toMatch(/vfx-worker/);
    expect(w.opts).toEqual({ type: "module" });
    const canvas = env.canvases[0];
    expect(canvas.className).toBe("vfx-layer"); // the page's CSS sizes and stacks it
    expect(canvas.attrs["aria-hidden"]).toBe("true");
    expect(canvas.style.visibility).toBe("hidden"); // idle until the worker has drawn
    const init = w.posted[0];
    expect(init.m).toMatchObject({ t: "init", width: 412, height: 915, resolution: 2 }); // density capped at 2
    expect(init.transfer).toEqual([(init.m as { canvas: unknown }).canvas]); // handed over, not copied

    w.say({ t: "ready", signatures: { boss_kato: { shake: 1.6, lunge: false } } });
    const layer = await started;
    layer.impact(10, 20, "PYRO", 1.4, "ice");
    layer.play({ kind: "pulse", rect: { x: 1, y: 2, w: 3, h: 4 }, element: "LEAF" });
    layer.setCap(40);
    expect(w.posted.slice(1).map((p) => p.m)).toEqual([
      { t: "impact", x: 10, y: 20, element: "PYRO", strength: 1.4, variant: "ice" },
      { t: "play", fx: { kind: "pulse", rect: { x: 1, y: 2, w: 3, h: 4 }, element: "LEAF" } },
      { t: "cap", n: 40 },
    ]);
    // The one thing the page asks synchronously — the board shake and the
    // lunge — comes from the table the worker sent when it was ready.
    expect(layer.signature("boss_kato")).toEqual({ shake: 1.6, lunge: false });
    expect(layer.signature("no_such_card")).toBeNull();

    // Shown only while it draws: the worker says when.
    w.say({ t: "vis", visible: true });
    expect(canvas.style.visibility).toBe("visible");
    w.say({ t: "vis", visible: false });
    expect(canvas.style.visibility).toBe("hidden");

    // The worker cannot see the window: the page tells it the new size.
    (window as unknown as { innerWidth: number }).innerWidth = 915;
    env.listeners.resize();
    expect(w.posted.at(-1)!.m).toEqual({ t: "resize", width: 915, height: 915 });

    layer.destroy();
    expect(w.posted.at(-1)!.m).toEqual({ t: "destroy" });
    expect(canvas.removed).toBe(true);
    expect(env.listeners.resize).toBeUndefined();
  });

  it("a worker that cannot draw says so, and leaves nothing behind for the page's own layer", async () => {
    const env = page();
    const started = createWorkerLayer();
    FakeWorker.last.say({ t: "fail", reason: "no requestAnimationFrame in a worker" });
    await expect(started).rejects.toThrow(/requestAnimationFrame/);
    expect(FakeWorker.last.terminated).toBe(true);
    expect(env.canvases[0].removed).toBe(true);
  });

  it("a worker script that fails to load (a chunk gone after a deploy) is the same failure", async () => {
    const env = page();
    const started = createWorkerLayer();
    FakeWorker.last.onerror!({});
    await expect(started).rejects.toThrow(/effects worker error/);
    expect(FakeWorker.last.terminated).toBe(true);
    expect(env.canvases[0].removed).toBe(true);
  });

  it("a worker that never answers is given up on", async () => {
    vi.useFakeTimers();
    const env = page();
    const started = createWorkerLayer();
    const failed = expect(started).rejects.toThrow(/did not start/);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(FakeWorker.last.terminated).toBe(false); // starting loads Pixi: seconds on a slow connection
    await vi.advanceTimersByTimeAsync(1);
    await failed;
    expect(FakeWorker.last.terminated).toBe(true);
    expect(env.canvases[0].removed).toBe(true);
  });

  it("a canvas that cannot be handed over fails the start", async () => {
    const env = page({ failTransfer: true });
    await expect(createWorkerLayer()).rejects.toThrow(/already has a context/);
    expect(FakeWorker.last.terminated).toBe(true);
    expect(env.canvases[0].removed).toBe(true);
  });

  it("after a good start, a crash in the worker costs the effects, never the game", async () => {
    page();
    const started = createWorkerLayer();
    FakeWorker.last.say({ t: "ready", signatures: {} });
    const layer = await started;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => FakeWorker.last.onerror!({ message: "boom" })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    expect(() => layer.impact(1, 1, "BOLT")).not.toThrow();
  });
});

describe("which thread the effects draw on", () => {
  function browser({ search = "", stored = null as string | null, storageThrows = false, worker = true, offscreen = true, transfer = true } = {}) {
    vi.stubGlobal("location", { search });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => {
        if (storageThrows) throw new Error("storage is blocked");
        return k === "we_vfx_page" ? stored : null;
      },
    });
    vi.stubGlobal("Worker", worker ? class {} : undefined);
    vi.stubGlobal("OffscreenCanvas", offscreen ? class {} : undefined);
    class Canvas {}
    if (transfer) Object.assign(Canvas.prototype, { transferControlToOffscreen() {} });
    vi.stubGlobal("HTMLCanvasElement", Canvas);
  }

  it("a worker wherever the browser can hand one a canvas", () => {
    browser();
    expect(workerLayerSupported()).toBe(true);
    browser({ storageThrows: true }); // private mode: no override, decided on features
    expect(workerLayerSupported()).toBe(true);
  });

  it("the page's own thread where it cannot", () => {
    browser({ worker: false });
    expect(workerLayerSupported()).toBe(false);
    browser({ offscreen: false });
    expect(workerLayerSupported()).toBe(false);
    browser({ transfer: false });
    expect(workerLayerSupported()).toBe(false);
  });

  it("?vfx=page, or we_vfx_page in storage, keeps them on the page", () => {
    browser({ search: "?vfx=page" });
    expect(workerLayerSupported()).toBe(false);
    browser({ stored: "1" });
    expect(workerLayerSupported()).toBe(false);
  });

  it("one density rule wherever the layer runs", () => {
    expect(layerResolution(1)).toBe(1);
    expect(layerResolution(1.5)).toBe(1.5);
    expect(layerResolution(3)).toBe(2);
    expect(layerResolution(0)).toBe(1);
  });
});

describe("the wiring", () => {
  const IMPACTS = code(src("ui/vfx/use-spell-impacts.ts"));
  const WORKER = code(src("ui/vfx/vfx-worker.ts"));
  const LAYER = code(src("ui/vfx/impact-layer.ts"));

  it("the game tries the worker first and falls back to the page's own layer", () => {
    expect(IMPACTS).toMatch(/workerLayerSupported\(\)\s*\?\s*createWorkerLayer\(\)\.catch\(/);
    expect(IMPACTS).toMatch(/return onPage\(\)/);
    expect(IMPACTS).toMatch(/const onPage = \(\) => import\("\.\/impact-layer"\)/);
  });

  it("the page's half never imports Pixi or the layer itself (a type is fine)", () => {
    for (const f of ["ui/vfx/worker-layer.ts", "ui/vfx/worker-protocol.ts", "ui/vfx/use-spell-impacts.ts"]) {
      const s = code(src(f));
      expect(s, f).not.toMatch(/from "pixi\.js"/);
      expect(s, f).not.toMatch(/^import (?!type )[^;]*from "\.\/impact-layer"/m);
    }
  });

  it("the worker's Pixi has no document: it is told before the layer starts", () => {
    const adapter = WORKER.indexOf("DOMAdapter.set(WebWorkerAdapter)");
    expect(adapter).toBeGreaterThan(-1);
    expect(adapter).toBeLessThan(WORKER.indexOf("createImpactLayer({"));
  });

  it("the layer reaches for the page only on the page", () => {
    // The texture canvases: the page's kind, or an OffscreenCanvas in a worker.
    expect(LAYER.match(/document\.createElement/g)).toHaveLength(1);
    expect(LAYER).toMatch(/if \(typeof document !== "undefined"\) \{\s*const c = document\.createElement\("canvas"\)/);
    // With a host, a failed start must throw: the page has somewhere to go.
    expect(LAYER).toMatch(/catch \(err\) \{\s*if \(host\) throw err;\s*return noopLayer\(\);/);
  });

  it("the build emits the worker as a module (Pixi splits its renderer into chunks)", () => {
    expect(code(src("../vite.config.ts"))).toMatch(/worker: \{ format: "es" \}/);
  });
});
