// THE PHONE'S BACK BUTTON — ui/back-stack.ts, against a stand-in for the
// browser's history that behaves like the real one where it matters: `back()`
// lands LATER, in a task of its own, never inside the call that asked for it.
import { describe, expect, it } from "vitest";
import { createBackStack, type HistoryLike } from "../../ui/back-stack";

function phone(startTab = "home") {
  const entries: unknown[] = [null];
  let at = 0;
  let exited = false;
  const tasks: (() => void)[] = [];
  const history: HistoryLike = {
    get state() { return entries[at]; },
    pushState(data) { entries.splice(at + 1); entries.push(data); at = entries.length - 1; },
    replaceState(data) { entries[at] = data; },
    back() {
      tasks.push(() => {
        if (at === 0) { exited = true; return; }
        at -= 1;
        stack.pop(entries[at]);
      });
    },
  };
  const stack = createBackStack(history);
  let tab = startTab;
  stack.attach({ currentTab: () => tab, restoreTab: (t) => { tab = t; } });
  const settle = () => { while (tasks.length) tasks.shift()!(); };
  return {
    stack,
    settle,
    /** One press of back, and everything it sets off landing. */
    press() { history.back(); settle(); },
    goTab(t: string) { tab = t; stack.tab(t); },
    get tab() { return tab; },
    get exited() { return exited; },
    /** How many presses of back stay inside the app (forward entries, which a real
     *  browser also keeps until the next push, are not reachable by back). */
    get depth() { return at + 1; },
    get entries() { return entries.length; },
  };
}

type Phone = ReturnType<typeof phone>;

/** A layer the way the app registers one: back calls `onBack`, which closes it,
 *  and closing it by any route releases it. */
function layer(p: Phone, name: string, log: string[], sticky = false, onBack?: () => void) {
  let open = true;
  const release = p.stack.open(() => {
    if (onBack) return onBack();
    open = false;
    log.push(name);
    release();
  }, sticky);
  return {
    close() { if (open) { open = false; release(); } },
    get open() { return open; },
  };
}

describe("the phone's back button walks back through the app", () => {
  it("closes the layer on top, then the one under it, then leaves the app", () => {
    const p = phone();
    const log: string[] = [];
    layer(p, "builder", log);
    layer(p, "card detail", log);
    p.press();
    expect(log).toEqual(["card detail"]);
    p.press();
    expect(log).toEqual(["card detail", "builder"]);
    expect(p.exited).toBe(false);
    p.press();
    expect(p.exited).toBe(true);
  });

  it("retraces tabs before it leaves", () => {
    const p = phone("home");
    p.goTab("arena");
    p.goTab("shop");
    p.press();
    expect(p.tab).toBe("arena");
    p.press();
    expect(p.tab).toBe("home");
    p.press();
    expect(p.exited).toBe(true);
  });

  it("a layer closed by its own ✕ never costs a press", () => {
    const p = phone("home");
    const log: string[] = [];
    p.goTab("arena");
    layer(p, "deck picker", log).close();
    p.settle();
    p.press();
    // Straight to the tab before — not a press that lands on the Arena it is already showing.
    expect(p.tab).toBe("home");
    expect(log).toEqual([]);
  });

  it("opening and closing things does not grow the history", () => {
    const p = phone();
    const log: string[] = [];
    for (let i = 0; i < 25; i++) {
      layer(p, "sheet", log).close();
      p.settle();
    }
    expect(p.depth).toBe(1);
    expect(p.entries).toBeLessThanOrEqual(2);
  });

  it("a tab switch made in the same tap as a close is kept, not rewound", () => {
    // The collection's "where does it drop?" jump closes the collection AND opens Story.
    const p = phone("home");
    const log: string[] = [];
    layer(p, "collection", log).close();
    p.goTab("story");
    p.settle();
    expect(p.tab).toBe("story");
    p.press();
    expect(p.tab).toBe("home");
    p.press();
    expect(p.exited).toBe(true);
  });

  it("a match keeps the press: back opens its menu and closes it, and never leaves", () => {
    const p = phone("arena");
    const log: string[] = [];
    let menu: ReturnType<typeof layer> | null = null;
    const match = layer(p, "match", log, true, () => { menu = layer(p, "menu", log); });
    p.press();
    expect(match.open).toBe(true);
    expect(menu!.open).toBe(true);
    p.press();
    expect(menu!.open).toBe(false);
    expect(match.open).toBe(true);
    p.press();
    p.press();
    expect(match.open).toBe(true);
    expect(p.exited).toBe(false);
    // The match ends by its own buttons; the next back leaves, with no dead press between.
    match.close();
    p.settle();
    p.press();
    expect(p.exited).toBe(true);
  });

  it("registering twice in one tick, as StrictMode does, leaves one entry", () => {
    const p = phone();
    const log: string[] = [];
    const first = p.stack.open(() => log.push("a"));
    first(); // StrictMode's pretend unmount...
    p.stack.open(() => log.push("b")); // ...and the real mount
    p.settle();
    expect(p.depth).toBe(2);
    p.press();
    expect(log).toEqual(["b"]);
    p.press();
    expect(p.exited).toBe(true);
  });

  it("an entry left dead underneath another layer is stepped over", () => {
    const p = phone("home");
    const log: string[] = [];
    const profile = layer(p, "profile", log);
    layer(p, "rules", log);
    profile.close(); // closed from underneath, so there is no entry of its own on screen to rewind
    p.settle();
    p.press();
    expect(log).toEqual(["rules"]);
    p.press();
    expect(p.exited).toBe(true);
  });
});
