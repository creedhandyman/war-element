/** ANONYMOUS PLAY EVENTS (owner, 2026-10-06): how many people try the game, and
 *  where a new player stops.
 *
 *  The game keeps everything on the device, so Supabase only ever heard from
 *  players who signed in for a cloud save — three accounts, all ours. This sends
 *  a handful of milestones to `public.play_events` with a random id made on the
 *  device: no name, no email, no account, nothing about the save. The table
 *  takes inserts from anyone and lets no one but the project owner read it (see
 *  the `play_events_anonymous_log` migration); `play_funnel` and `play_daily`
 *  are its read-outs in the dashboard.
 *
 *  WHAT IS SENT: `first_open` (detail new|returning — a fresh save or an old
 *  one), `day_open` (once a day: daily players), `tutorial_done` /
 *  `tutorial_skip` / `magic_done` (the scripted battles), `first_pack`, and
 *  `story_win` / `story_loss` with the node id as detail (how far through the
 *  campaign players get, and where they lose).
 *
 *  ONCE EACH. Every event but `day_open` is sent once per device per detail,
 *  ever; `day_open` once per day. The database refuses a same-day repeat too.
 *  A send that fails (offline) stays queued and goes with the next one.
 *
 *  NO SDK: a plain `fetch` to the REST endpoint, so this never pulls the 204 KB
 *  Supabase client onto the first frame (net-config.ts). Never throws, never
 *  waits on anything the game does. Off in dev and tests: those are not players.
 */
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Every event the game sends. The table checks names against
 *  `^[a-z0-9_]{1,32}$`, so a new one needs no migration — just add it here. */
export const PLAY_EVENTS = [
  "first_open", "day_open",
  "tutorial_done", "tutorial_skip", "magic_done",
  "first_pack", "story_win", "story_loss",
] as const;
export type PlayEvent = (typeof PLAY_EVENTS)[number];

const DEVICE_KEY = "we_device_id";
const SENT_KEY = "we_events_sent";
const PENDING_KEY = "we_events_pending";

interface Pending { key: string; event: PlayEvent; detail?: string }

const enabled = (): boolean =>
  typeof window !== "undefined" && typeof fetch === "function" && !!URL && !!ANON
  && !import.meta.env.DEV && import.meta.env.MODE !== "test";

const today = () => new Date().toISOString().slice(0, 10);

function readList<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function writeList(key: string, list: unknown[]): void {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* full or blocked: skip */ }
}

function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
            (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch { return null; }
}

/** A detail the table accepts (`^[a-z0-9_]{1,24}$`): lower-case letters,
 *  digits, underscores — "L1" becomes "l1". */
export const cleanDetail = (d: string | undefined): string | undefined => {
  const v = d?.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
  return v || undefined;
};

/** Record a milestone. Safe to call as often as the moment recurs: it is sent
 *  once (see above), in the background. */
export function track(event: PlayEvent, detail?: string): void {
  if (!enabled()) return;
  const d = cleanDetail(detail);
  const key = event === "day_open" ? `day_open:${today()}` : `${event}:${d ?? ""}`;
  const sent = readList<string>(SENT_KEY);
  const pending = readList<Pending>(PENDING_KEY);
  if (sent.includes(key)) return;
  // Already queued (an earlier send failed): no second copy, but this is a
  // good moment to try the queue again.
  if (!pending.some((p) => p.key === key)) writeList(PENDING_KEY, [...pending, { key, event, detail: d }].slice(-50));
  void flush();
}

let flushing = false;

/** Send whatever is queued. Stops at the first failure and tries again on the
 *  next call — offline, the queue simply waits. */
export async function flush(): Promise<void> {
  if (!enabled() || flushing) return;
  const device = deviceId();
  if (!device) return;
  flushing = true;
  try {
    // The head of the queue, re-read each time round: an event queued while
    // this one was in flight goes in the same flush, not whenever the next
    // event happens to come along.
    // Capped: storage that reads but will not write would keep the same head.
    let p = readList<Pending>(PENDING_KEY)[0];
    for (let n = 0; p && n < 50; n++, p = readList<Pending>(PENDING_KEY)[0]) {
      let ok = false;
      try {
        const res = await fetch(`${URL}/rest/v1/play_events`, {
          method: "POST",
          keepalive: true,
          headers: {
            apikey: ANON!,
            Authorization: `Bearer ${ANON}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ device_id: device, event: p.event, detail: p.detail ?? null }),
        });
        // 409: already recorded today — as good as sent. Any other refusal
        // (a 4xx) would refuse forever, so it is dropped rather than retried.
        ok = res.ok || (res.status >= 400 && res.status < 500);
      } catch { ok = false; }
      if (!ok) break;
      writeList(PENDING_KEY, readList<Pending>(PENDING_KEY).filter((q) => q.key !== p.key));
      // Yesterday's day_open keys are no use: keep the list from growing.
      const t = today();
      const sent = readList<string>(SENT_KEY).filter((k) => !k.startsWith("day_open:") || k === `day_open:${t}`);
      writeList(SENT_KEY, [...sent, p.key]);
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") window.addEventListener("online", () => { void flush(); });
