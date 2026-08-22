/** Email account + cloud save — carrying a player's progress between devices.
 *
 *  ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *  Everything the player owns lives in localStorage: the campaign, the
 *  collection, the shards, the squads. That is per-browser and per-device, so
 *  installing the PWA on a second phone starts a stranger's game, and clearing
 *  site data ends the first one. This is the way back.
 *
 *  ── WHY A CODE AND NOT A MAGIC LINK ───────────────────────────────────────
 *  Supabase offers both from the same call. A magic link opens the device's
 *  DEFAULT BROWSER, which for a game added to the home screen is not the app —
 *  the player lands signed-in in Safari looking at a copy of the game with none
 *  of their local progress, while the installed one is still signed out. The
 *  six-digit code is typed into the app that asked for it, so it works
 *  identically in a tab, in a home-screen PWA, and in a webview.
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
      persistSession: true,      // stay signed in across app launches
      autoRefreshToken: true,
      detectSessionInUrl: false, // codes, not links — nothing arrives in the URL
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
export async function requestCode(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = db();
  if (!c) return { ok: false, error: "Online is not configured on this build." };
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: "That does not look like an email address." };
  const { error } = await c.auth.signInWithOtp({
    email: clean,
    options: { shouldCreateUser: true },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
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
