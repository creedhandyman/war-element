/** Email account + cloud save — carrying a player's progress between devices.
 *
 *  ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *  Everything the player owns lives in localStorage: the campaign, the
 *  collection, the shards, the squads. That is per-browser and per-device, so
 *  installing the PWA on a second phone starts a stranger's game, and clearing
 *  site data ends the first one. This is the way back.
 *
 *  ── LINK AND CODE, BOTH ───────────────────────────────────────────────────
 *  Supabase sends one email from one call, and WHICH it contains is not the
 *  app's choice — it is the project's. Template editing is gated behind custom
 *  SMTP, and the built-in sender's default template carries
 *  `{{ .ConfirmationURL }}` and no `{{ .Token }}`. So on a project using the
 *  built-in mailer there is no six-digit code in existence, whatever the form
 *  asks for. This module redeems both: `detectSessionInUrl` consumes a link,
 *  `verifyCode` consumes a code, and neither cares which one arrived.
 *
 *  The CODE is the better flow and the one to move to. A link tapped on a phone
 *  opens the default browser, which for a game added to the home screen is not
 *  the app — the player ends up signed in inside Safari looking at a copy of
 *  the game with none of their local progress, while the installed one is still
 *  signed out. A code is typed into the app that asked for it and works
 *  identically in a tab, in a PWA and in a webview. Configuring custom SMTP is
 *  what unlocks it; until then the link is what there is.
 *
 *  ── WHAT IS NOT HERE ──────────────────────────────────────────────────────
 *  No passwords. The app never sees, stores or transmits one, which is the
 *  cheapest way to be safe with credentials: there is nothing to leak. No
 *  merge, either — see `chooseSave` in the UI. Two real saves are a question
 *  for the player, not a resolution for the code to guess at.
 *
 *  ── THE TABLE (run once in the Supabase SQL editor) ───────────────────────
 *    create table if not exists player_saves (
 *      user_id    uuid primary key references auth.users on delete cascade,
 *      data       jsonb not null,
 *      updated_at timestamptz not null default now()
 *    );
 *    alter table player_saves enable row level security;
 *    create policy "own save read"  on player_saves for select
 *      using (auth.uid() = user_id);
 *    create policy "own save write" on player_saves for insert
 *      with check (auth.uid() = user_id);
 *    create policy "own save update" on player_saves for update
 *      using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 *  RLS is not optional here. Without those policies the anon key can read every
 *  row in the table — every player's save is public, and one of them is the
 *  owner's. The policies are what make `user_id` mean anything.
 */
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the env vars are present. Same pair online play uses — one
 *  project, two features, so configuring either configures both. */
export const accountConfigured = Boolean(URL && ANON);

/** A SEPARATE client from `online.ts`, deliberately.
 *
 *  That one is a stateless broadcast pipe and explicitly documents itself as
 *  "no DB, no auth". Sharing an instance would mean signing in silently changes
 *  which key the realtime channel authenticates with, coupling a PvP match to
 *  whether the player happens to have an account. Two clients, two concerns. */
let client: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (!accountConfigured) return null;
  client ??= createClient(URL!, ANON!, {
    auth: {
      persistSession: true,   // stay signed in across app launches
      autoRefreshToken: true,
      // TRUE, because on this project the email is a LINK and not a code.
      //
      // Supabase gates email-template editing behind custom SMTP, and the
      // built-in sender's default template carries `{{ .ConfirmationURL }}` and
      // no `{{ .Token }}` — so there is no six-digit code to type, whatever the
      // form below asks for. The link is the only credential that exists on this
      // setup, and this is what redeems it: supabase-js reads the tokens out of
      // the URL fragment on construction and establishes the session.
      //
      // The code path is KEPT rather than removed. It is the better flow the
      // moment custom SMTP is configured — a link tapped on a phone opens the
      // default browser rather than the installed game — so both are live and
      // whichever the email contains will work.
      detectSessionInUrl: true,
    },
  });
  return client;
}

const TABLE = "player_saves";

/** The localStorage keys that ARE the player's progress.
 *
 *  Explicitly listed rather than "everything starting with we_", because the
 *  set is not all one thing: `we_music_muted` is a property of this DEVICE, and
 *  syncing it would mean muting the game on your phone because you muted it on
 *  a laptop. Progress travels; preferences stay. */
export const SAVE_KEYS = [
  "we_story_v1",        // the campaign: progress, collection, shards, hero
  "we_squads_v1",       // saved squads (shared by Arena and campaign)
  "we_custom_decks_v1", // the legacy deck library, still read on load
  "we_auto_defaults",   // per-class auto-battle defaults
] as const;

export interface SaveBundle {
  /** key -> raw JSON string, exactly as localStorage holds it. Stored raw so
   *  this layer never has to understand a save's shape, and a save format that
   *  changes needs no migration here. */
  keys: Record<string, string>;
  /** When this bundle was written, ISO. Used to SHOW the player which side is
   *  older, never to pick for them. */
  savedAt: string;
  /** Device that wrote it, for the same reason — "your phone" reads better than
   *  a timestamp alone when deciding which save to keep. */
  device?: string;
}

/** Read the local save out of localStorage. Missing keys are simply absent. */
export function localBundle(): SaveBundle {
  const keys: Record<string, string> = {};
  for (const k of SAVE_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v != null) keys[k] = v;
    } catch { /* storage blocked — treat as absent */ }
  }
  return { keys, savedAt: new Date().toISOString(), device: deviceName() };
}

/** Write a bundle into localStorage, replacing what is there.
 *
 *  Keys ABSENT from the bundle are removed, not left alone: restoring a save
 *  that has no squads must not leave the previous player's squads on the
 *  device. "Restore" means the device looks like the save, not like a mixture. */
export function applyBundle(b: SaveBundle): void {
  for (const k of SAVE_KEYS) {
    try {
      if (b.keys[k] != null) localStorage.setItem(k, b.keys[k]);
      else localStorage.removeItem(k);
    } catch { /* ignore */ }
  }
}

function deviceName(): string {
  if (typeof navigator === "undefined") return "a device";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "a device";
}

// ── auth ────────────────────────────────────────────────────────────────────

export type AccountUser = { id: string; email: string };

/** Did this page load from a sign-in link?
 *
 *  Read at MODULE LOAD, before any client is constructed, because
 *  `detectSessionInUrl` consumes the fragment and scrubs the address bar — by
 *  the time anything renders there is nothing left to look at. Without it,
 *  tapping the link drops the player on the Home screen with no sign that
 *  anything happened, which reads exactly like a link that did not work.
 *
 *  Matches the recovery/error shapes too, so a LINK THAT FAILED (expired, or
 *  already used) is distinguishable from a cold start rather than being
 *  silently identical to one. */
export const arrivedFromEmailLink: boolean = (() => {
  if (typeof window === "undefined") return false;
  const h = window.location.hash || "";
  const q = window.location.search || "";
  return /access_token=|refresh_token=|type=(magiclink|signup|recovery)|error_code=|error_description=/.test(h + q);
})();

/** A code that has been asked for but not yet typed in.
 *
 *  Persisted, and that is the entire point. Reading the email means LEAVING the
 *  app — closing the panel at best, and on iOS a backgrounded tab is evicted
 *  and reloaded freely. React state survives neither. So the player came back
 *  to the EMAIL form with no code box, asked for a second code, hit the
 *  one-a-minute limit, saw a red line below the fold, and reported it as
 *  "I get the code, enter it, click sign in and it won't".
 *
 *  The auth logs said the same thing from the other side: every `/verify` that
 *  ever reached the server succeeded. Nothing was wrong with the codes. What
 *  failed was getting back to the box to type one into. */
const PENDING_KEY = "we_signin_pending";

/** Supabase will not send a second code to the same address inside a minute. */
export const RESEND_COOLDOWN_MS = 60_000;
/** And the code itself dies after an hour, so a pending older than that is
 *  scrap — restoring it would put someone on a code screen with no live code. */
const PENDING_TTL_MS = 60 * 60_000;

export interface PendingSignIn {
  email: string;
  /** epoch ms of the request that is waiting to be redeemed */
  requestedAt: number;
}

/** The sign-in this device is part-way through, or null. */
export function pendingSignIn(now: number = Date.now()): PendingSignIn | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PendingSignIn>;
    if (typeof v?.email !== "string" || typeof v?.requestedAt !== "number") return null;
    if (now - v.requestedAt > PENDING_TTL_MS) { clearPendingSignIn(); return null; }
    return { email: v.email, requestedAt: v.requestedAt };
  } catch { return null; }
}

export function setPendingSignIn(email: string, now: number = Date.now()): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ email, requestedAt: now })); } catch { /* ignore */ }
}

export function clearPendingSignIn(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

/** How long until another code may be sent to this address, in ms. 0 = now.
 *
 *  Shown as a countdown rather than enforced silently: a Resend button that
 *  does nothing is indistinguishable from a broken one, and mashing it is what
 *  invalidates the code already sitting in the player's inbox. */
export function resendWaitMs(p: PendingSignIn | null, now: number = Date.now()): number {
  if (!p) return 0;
  return Math.max(0, p.requestedAt + RESEND_COOLDOWN_MS - now);
}

export async function currentUser(): Promise<AccountUser | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return sessionUser(data.session);
}

const sessionUser = (s: Session | null): AccountUser | null =>
  s?.user?.id && s.user.email ? { id: s.user.id, email: s.user.email } : null;

/** Fires on sign-in, sign-out and token refresh. Returns an unsubscribe. */
export function onAuthChange(fn: (u: AccountUser | null) => void): () => void {
  const c = db();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_e, session) => fn(sessionUser(session)));
  return () => data.subscription.unsubscribe();
}

/** Step one: ask Supabase to email a six-digit code.
 *
 *  `shouldCreateUser` is TRUE on purpose — there is no separate sign-up. A game
 *  account is an email and nothing else, so "sign in" and "make an account" are
 *  the same action and asking the player which one they want is a question they
 *  have no way to answer on a new phone. */
export type RequestResult =
  | { ok: true }
  /** `cooldown` means a code was ALREADY SENT and is still live — the send is
   *  what is blocked, not the sign-in. Worth distinguishing from a real error,
   *  because the right response is "go type the one you have", not "try again". */
  | { ok: false; error: string; cooldown?: boolean; waitMs?: number };

/** Is this Supabase error the one-a-minute send limit, and if so, how long?
 *
 *  Supabase phrases it as "For security purposes, you can only request this
 *  after N seconds." Trusting our own clock instead would be wrong whenever the
 *  request came from another device or before a reload. */
function cooldownMs(
  err: { status?: number; code?: string; message: string },
  fallback: number,
): number | null {
  const limited = err.status === 429
    || /rate limit|only request this after|too many requests/i.test(err.message)
    || /rate_limit/i.test(err.code ?? "");
  if (!limited) return null;
  const m = /after (\d+)\s*second/i.exec(err.message);
  return m ? Number(m[1]) * 1000 : Math.max(fallback, 1000);
}

export async function requestCode(email: string): Promise<RequestResult> {
  const c = db();
  if (!c) return { ok: false, error: "Online is not configured on this build." };
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: "That does not look like an email address." };
  const { error } = await c.auth.signInWithOtp({
    email: clean,
    options: {
      shouldCreateUser: true,
      // Come back HERE. Without it the link lands on the project's Site URL,
      // which ships as `http://localhost:3000` and is why the first link anyone
      // clicked went nowhere. An origin that is not on the project's redirect
      // allow-list is ignored and Site URL is used instead, so this is safe to
      // send from a dev server too — it simply falls back.
      emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
    },
  });
  if (!error) { setPendingSignIn(clean); return { ok: true }; }
  const wait = cooldownMs(error, resendWaitMs(pendingSignIn()));
  if (wait == null) return { ok: false, error: error.message };
  // Do NOT clear the pending here — the code it refers to is the live one.
  const secs = Math.ceil(wait / 1000);
  return {
    ok: false,
    cooldown: true,
    waitMs: wait,
    error: `A code was already sent to ${clean}. Use that one — another can be sent in ${secs}s.`,
  };
}

/** Step two: exchange the emailed code for a session. */
export async function verifyCode(
  email: string,
  code: string,
): Promise<{ ok: true; user: AccountUser } | { ok: false; error: string }> {
  const c = db();
  if (!c) return { ok: false, error: "Online is not configured on this build." };
  const { data, error } = await c.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "email",
  });
  if (error) return { ok: false, error: error.message };
  const u = sessionUser(data.session);
  if (u) clearPendingSignIn();
  return u ? { ok: true, user: u } : { ok: false, error: "That code did not sign you in. Try again." };
}

export async function signOut(): Promise<void> {
  await db()?.auth.signOut();
}

// ── the save itself ─────────────────────────────────────────────────────────

/** Fetch this account's cloud save, or null when there has never been one. */
export async function pullSave(): Promise<
  { ok: true; bundle: SaveBundle | null } | { ok: false; error: string }
> {
  const c = db();
  if (!c) return { ok: false, error: "Online is not configured on this build." };
  const { data, error } = await c.from(TABLE).select("data").maybeSingle();
  // PGRST116 is "no rows", which is not an error — it is a new account.
  if (error && error.code !== "PGRST116") return { ok: false, error: tableHint(error.message) };
  const raw = (data as { data?: unknown } | null)?.data;
  return { ok: true, bundle: isBundle(raw) ? raw : null };
}

/** Write this account's cloud save, replacing whatever was there. */
export async function pushSave(bundle: SaveBundle): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = db();
  if (!c) return { ok: false, error: "Online is not configured on this build." };
  const { data } = await c.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) return { ok: false, error: "You are signed out." };
  const { error } = await c.from(TABLE).upsert(
    { user_id: uid, data: bundle, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  return error ? { ok: false, error: tableHint(error.message) } : { ok: true };
}

/** The one setup mistake worth naming in the UI rather than echoing Postgres
 *  at a player: the table has not been created yet. */
const tableHint = (msg: string): string =>
  /relation .* does not exist|schema cache/i.test(msg)
    ? "Cloud saves are not set up on this project yet — the player_saves table is missing."
    : msg;

function isBundle(v: unknown): v is SaveBundle {
  if (!v || typeof v !== "object") return false;
  const b = v as Partial<SaveBundle>;
  return !!b.keys && typeof b.keys === "object" && typeof b.savedAt === "string";
}

// ── comparing two saves ─────────────────────────────────────────────────────

/** How much of a game a bundle represents, for showing the player which side is
 *  which when both have progress.
 *
 *  Read off the raw JSON deliberately loosely: this module does not import the
 *  save's TYPES, so a save-format change cannot break sign-in. A field that has
 *  moved reads as 0 here, which understates a save rather than inventing one. */
export interface SaveSummary {
  cards: number;
  cleared: number;
  shards: number;
  squads: number;
  empty: boolean;
}

/** Are these two bundles the same SAVE?
 *
 *  Compares the payload only — `savedAt` and `device` are metadata about the
 *  write, not the game, and `localBundle()` stamps a fresh timestamp every time
 *  it is called, so comparing whole objects would never report a match.
 *
 *  Exists because the conflict warning was firing on identical saves. Right
 *  after an upload the cloud IS this device, and "both have progress, one will
 *  replace the other" is alarming, true, and useless — the kind of warning a
 *  player learns to click past, which is exactly what you do not want on the
 *  one screen that can delete a campaign. */
export function sameSave(a: SaveBundle | null, b: SaveBundle | null): boolean {
  if (!a || !b) return false;
  return SAVE_KEYS.every((k) => (a.keys[k] ?? null) === (b.keys[k] ?? null));
}

export function summarize(b: SaveBundle | null): SaveSummary {
  const out: SaveSummary = { cards: 0, cleared: 0, shards: 0, squads: 0, empty: true };
  if (!b) return out;
  try {
    const story = b.keys["we_story_v1"] ? JSON.parse(b.keys["we_story_v1"]) : null;
    if (story && typeof story === "object") {
      const s = story as Record<string, unknown>;
      if (Array.isArray(s.collection)) out.cards = s.collection.length;
      else if (Array.isArray(s.owned)) out.cards = s.owned.length;
      if (Array.isArray(s.cleared)) out.cleared = s.cleared.length;
      const hero = s.hero as { shards?: unknown } | undefined;
      if (hero && typeof hero.shards === "number") out.shards = hero.shards;
    }
  } catch { /* unreadable — leave it at zero, which reads as "nothing here" */ }
  try {
    const sq = b.keys["we_squads_v1"] ? JSON.parse(b.keys["we_squads_v1"]) : null;
    const list = (sq as { squads?: unknown[] } | null)?.squads;
    if (Array.isArray(list)) out.squads = list.length;
  } catch { /* ignore */ }
  out.empty = out.cards === 0 && out.cleared === 0 && out.shards === 0 && out.squads === 0;
  return out;
}
