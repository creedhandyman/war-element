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
    ? {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    : { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  return { reload, store };
}

/** The module as a fresh page loads it: the warm queue, its one start and the
 *  resume note are all per page, and a reload is a new page. */
async function freshPage() {
  vi.resetModules();
  return await import("../../ui/stale-chunks");
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

describe("warm: every screen fetched while its name still resolves", () => {
  it("fetches each queued screen once, in order; a miss neither stops the rest nor reloads", async () => {
    const { reload } = browser();
    const page = await freshPage();
    const order: string[] = [];
    page.warmLater(async () => { order.push("tower"); });
    page.warmLater(() => { order.push("collection"); return gone(); });
    page.warmLater(async () => { order.push("draft"); });
    expect(await page.warmChunks()).toBe(2);
    expect(order).toEqual(["tower", "collection", "draft"]);
    expect(reload).not.toHaveBeenCalled();
    expect(await page.warmChunks(), "the queue is spent").toBe(0);
  });

  it("starts once, a moment after the first frame", async () => {
    browser();
    const page = await freshPage();
    vi.useFakeTimers();
    const load = vi.fn(async () => {});
    page.warmLater(load);
    page.warmSoon(1500);
    page.warmSoon(1500); // StrictMode mounts twice in dev
    await vi.advanceTimersByTimeAsync(1499);
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("resume: a reload that has to happen goes where the player was going", () => {
  it("the page after the reload opens the screen that was being opened — once", async () => {
    const { reload } = browser();
    const before = await freshPage();
    before.rememberPlace(() => ({ tab: "tower" }));
    expect(await standing(before.resilient(gone)())).toBe("pending");
    expect(reload).toHaveBeenCalledTimes(1);
    const after = await freshPage();
    expect(after.resumePlace()).toEqual({ tab: "tower" });
    expect(after.resumePlace(), "the same answer for the rest of that page").toEqual({ tab: "tower" });
    // Spent: the player's own reload later boots on Home as usual.
    expect((await freshPage()).resumePlace()).toBeNull();
  });

  it("a note from a reload long ago is not where the player is going now", async () => {
    const { store } = browser();
    const before = await freshPage();
    before.rememberPlace(() => ({ tab: "shop" }));
    expect(before.reloadForUpdate()).toBe(true);
    store.set("we_update_reload", String(Date.now() - 5 * 60_000));
    expect((await freshPage()).resumePlace()).toBeNull();
  });

  it("a place that cannot be described still reloads — onto Home", async () => {
    const { reload, store } = browser();
    const page = await freshPage();
    page.rememberPlace(() => { throw new Error("mid-render"); });
    expect(page.reloadForUpdate()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.has("we_update_place")).toBe(false);
  });

  it("nothing is resumed on an ordinary boot", async () => {
    browser();
    expect((await freshPage()).resumePlace()).toBeNull();
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

  it("every deferred screen is queued for the background fetch, and the fetch starts at boot", () => {
    const deferred = APP.slice(APP.indexOf("function deferred<"), APP.indexOf("const ChatPanel = deferred("));
    expect(deferred).toContain("warmLater(load)");
    expect(read("main.tsx")).toMatch(/warmSoon\(\)/);
  });

  it("only the screens that reach the Supabase SDK stay cold, and no warmed one does", () => {
    const lines = APP.split("\n").filter((l) => /^const \w+ = deferred\(/.test(l));
    const cold = lines.filter((l) => /, false\);$/.test(l)).map((l) => l.match(/^const (\w+)/)![1]);
    expect(cold.sort()).toEqual(["AccountPanel", "ChatPanel"]);
    // ...and that is why: warming them would load the SDK (and, for online,
    // create a live client) on every visit, which the bundle split keeps off.
    expect(read("ui", "ChatPanel.tsx")).toMatch(/from "\.\.\/net\/online"/);
    expect(read("ui", "AccountPanel.tsx")).toMatch(/from "\.\.\/net\/account"/);
    for (const l of lines.filter((l) => !/, false\);$/.test(l))) {
      const file = l.match(/import\("\.\/(\w+)"\)/)![1];
      expect(read("ui", `${file}.tsx`), `${file} is warmed at boot`).not.toMatch(/from "\.\.\/net\/(online|account)"/);
    }
  });

  it("App says where the player is, and goes back there after an update reload", () => {
    expect(APP).toContain("rememberPlace(() => placeRef.current)");
    expect(APP).toMatch(/resumePlace<ResumePlace>\(\);\s*if \(!p\) return;\s*goTab\(p\.tab\)/);
  });
});
