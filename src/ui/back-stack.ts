// THE PHONE'S BACK BUTTON, as an in-app back.
//
// The game changes screens by state, never by URL, so the browser held one
// history entry for the whole session and Android's back gesture closed the
// installed app from anywhere: out of a squad being built, off a card's detail,
// in the middle of a match.
//
// Every open LAYER (an overlay, a sheet, a Story sub-screen, a match) now owns a
// history entry stamped with its id, and every change of tab gets an entry
// stamped with the tab. Back lands on an older entry: every layer NEWER than that
// entry closes, newest first, and the tab that entry recorded comes back. Below
// the entry the app opened on there is nothing of ours, so back leaves the app
// there, which is what back does at the root of any Android app.
//
// What keeps the browser's list and this one in step:
//
//  - A layer that closes ITSELF (its ✕, a tap on the backdrop) rewinds its own
//    entry, or the next press would land on a screen already showing and seem to
//    do nothing. `history.back()` lands later, not now, so anything recorded in
//    the same tap (the tab a "where does it drop?" jump switches to) waits for the
//    rewind to land and is recorded after it, instead of being the entry the
//    rewind takes away.
//  - An entry whose layer closed without a rewind (it closed while another sat
//    above it) is DEAD. Back steps over a dead entry on its own, and a new entry
//    replaces one rather than piling on top of it.
//  - A STICKY layer (a match, a draft) is never closed by back. Back lays its entry
//    again and hands it the press instead, because the only ways out of those are
//    buttons that surrender a match or throw away a run already paid for.

export interface HistoryLike {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  back(): void;
}

interface Entry {
  weKind: "tab" | "layer";
  /** A layer entry: that layer's id. A tab entry: the newest layer open when it was recorded. */
  weDepth: number;
  weTab: string;
}

interface Layer {
  id: number;
  sticky: boolean;
  onBack: () => void;
}

export interface BackStack {
  /** Stamp the entry the app is showing, and restore tabs through these. */
  attach(opts: { currentTab: () => string; restoreTab: (tab: string) => void }): void;
  /** A layer opened. Returns what to call when it closes any other way. */
  open(onBack: () => void, sticky?: boolean): () => void;
  /** The tab on screen is now `tab`. */
  tab(tab: string): void;
  /** Back landed on the entry holding `state`. */
  pop(state: unknown): void;
}

export function createBackStack(history: HistoryLike): BackStack {
  const layers: Layer[] = [];
  // Ids only grow, and start from the clock, so an entry an EARLIER page load
  // left in the browser's list always reads as older than anything open now.
  let nextId = Date.now();
  let currentTab = () => "";
  let restoreTab: (tab: string) => void = () => {};
  // Rewinds this stack started that have not landed yet, and what asked to be
  // recorded while they were on their way.
  let rewinding = 0;
  const waiting: (() => void)[] = [];

  const read = (state: unknown): Entry | null => {
    const e = state as Partial<Entry> | null;
    return e && (e.weKind === "tab" || e.weKind === "layer") && typeof e.weDepth === "number"
      ? (e as Entry)
      : null;
  };
  const isOpen = (id: number) => layers.some((l) => l.id === id);
  const isDead = (e: Entry | null) => e?.weKind === "layer" && !isOpen(e.weDepth);
  const record = (e: Entry) => {
    if (isDead(read(history.state))) history.replaceState(e, "");
    else history.pushState(e, "");
  };
  const rewind = () => {
    rewinding++;
    history.back();
  };

  const stack: BackStack = {
    attach(opts) {
      currentTab = opts.currentTab;
      restoreTab = opts.restoreTab;
      const seed: Entry = { weKind: "tab", weDepth: 0, weTab: currentTab() };
      history.replaceState(seed, "");
    },

    open(onBack, sticky = false) {
      const id = ++nextId;
      layers.push({ id, sticky, onBack });
      const entry: Entry = { weKind: "layer", weDepth: id, weTab: currentTab() };
      if (rewinding) waiting.push(() => { if (isOpen(id)) record(entry); });
      else record(entry);
      return () => {
        const at = layers.findIndex((l) => l.id === id);
        if (at < 0) return; // back closed it, and its entry is already behind us
        layers.splice(at, 1);
        const here = read(history.state);
        if (!rewinding && here?.weKind === "layer" && here.weDepth === id) rewind();
      };
    },

    tab(tab) {
      if (rewinding) {
        waiting.push(() => stack.tab(tab));
        return;
      }
      const here = read(history.state);
      if (here && !isDead(here) && here.weTab === tab) return;
      const top = layers.length ? layers[layers.length - 1].id : 0;
      record({ weKind: "tab", weDepth: top, weTab: tab });
    },

    pop(state) {
      const landed = read(state);
      if (rewinding) {
        rewinding--;
        if (rewinding) return;
        for (const run of waiting.splice(0)) run();
        // Something else closed while the rewind was on its way: step past it too.
        if (isDead(read(history.state))) rewind();
        return;
      }
      const depth = landed?.weDepth ?? 0;
      for (let i = layers.length - 1; i >= 0 && layers[i].id > depth; i--) {
        const layer = layers[i];
        if (layer.sticky) {
          record({ weKind: "layer", weDepth: layer.id, weTab: currentTab() });
          layer.onBack();
          return;
        }
        layers.splice(i, 1);
        layer.onBack();
      }
      if (isDead(landed)) {
        history.back();
        return;
      }
      if (landed && landed.weTab !== currentTab()) restoreTab(landed.weTab);
    },
  };
  return stack;
}

let shared: BackStack | null = null;

/** The page's one stack, answering the real back button. */
export function browserBackStack(): BackStack {
  if (!shared) {
    const stack = createBackStack(window.history);
    window.addEventListener("popstate", (ev) => stack.pop(ev.state));
    shared = stack;
  }
  return shared;
}
