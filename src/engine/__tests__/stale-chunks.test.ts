import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reloadForUpdate, resilient, setMatchLive } from "../../ui/stale-chunks";

/** A browser, as far as the reload rules can see one. */
function browser({ online = true, storage = true } = {}) {
  const reload = vi.fn();
  const store = new Map<string, string>();
  vi.stubGlobal("window", { location: { reload } });
  vi.stubGlobal("navigator", { onLine: online });
  vi.stubGlobal("sessionStorage", storage
    ? { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    : { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  return { reload };
}

const gone = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/DraftScreen-old.js"));
/** Where a promise stands after the microtasks have run. */
async function standing(p: Promise<unknown>): Promise<"pending" | "resolved" | "rejected"> {
  let state: "pending" | "resolved" | "rejected" = "pending";
  p.then(() => { state = "resolved"; }, () => { state = "rejected"; });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setMatchLive(false);
});

describe("a screen whose chunk is gone after a deploy", () => {
  it("reloads onto the new build and stays suspended meanwhile — once", async () => {
    const { reload } = browser();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    expect(await standing(resilient(gone)())).toBe("pending");
    expect(reload).toHaveBeenCalledTimes(1);
    // The fresh build still failing inside the guard asks instead of looping.
    vi.setSystemTime(1_010_000);
    expect(await standing(resilient(gone)())).toBe("rejected");
    expect(reload).toHaveBeenCalledTimes(1);
    // ...and a later failure is a later deploy: that one reloads again.
    vi.setSystemTime(1_030_000);
    expect(reloadForUpdate()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("never mid-match — a local match lives only in memory — so the boundary explains instead", async () => {
    const { reload } = browser();
    setMatchLive(true);
    expect(await standing(resilient(gone)())).toBe("rejected");
    expect(reload).not.toHaveBeenCalled();
  });

  it("never offline, where a reload is the browser's own error page", async () => {
    const { reload } = browser({ online: false });
    expect(await standing(resilient(gone)())).toBe("rejected");
    expect(reload).not.toHaveBeenCalled();
  });

  it("never without storage to remember it tried, or a broken build would reload forever", async () => {
    const { reload } = browser({ storage: false });
    expect(await standing(resilient(gone)())).toBe("rejected");
    expect(reload).not.toHaveBeenCalled();
  });

  it("passes a load that works straight through", async () => {
    const { reload } = browser();
    await expect(resilient(() => Promise.resolve(42))()).resolves.toBe(42);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("the wiring: no failed screen takes the app down with it", () => {
  const read = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8").replace(/\r\n/g, "\n");
  const APP = read("ui", "App.tsx");

  it("every deferred screen loads resiliently, inside its own boundary", () => {
    const deferred = APP.slice(APP.indexOf("function deferred<"), APP.indexOf("const ChatPanel = deferred("));
    expect(deferred).toContain("lazy(resilient(load))");
    expect(deferred).toMatch(/<ScreenBoundary[\s\S]*<Suspense[\s\S]*<Inner/);
    // Nothing code-split bypasses it: every lazy screen is made by `deferred`.
    expect(APP.match(/\blazy\(/g)).toHaveLength(1);
  });

  it("the online room loader is resilient too, and a match is never reloaded away", () => {
    expect(APP).toContain('resilient(() => import("../net/online"))');
    expect(APP).toMatch(/setMatchLive\(started && game\.phase !== "gameover"\)/);
  });

  it("the whole app sits in the last-resort boundary", () => {
    expect(read("main.tsx")).toMatch(/<AppBoundary>\s*<Boot \/>\s*<\/AppBoundary>/);
  });
});
