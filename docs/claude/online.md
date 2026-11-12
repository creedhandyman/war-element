# Accounts, online play and telemetry

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Accounts and cloud saves

Every save lives in localStorage (`we_story_v1`, `we_squads_v1`,
`we_custom_decks_v1`, `we_auto_defaults`), which is per-browser and per-device:
installing the PWA on a second phone starts a stranger's game, and clearing site
data ends the first one. `src/net/account.ts` is the way back — email sign-in
plus a save you can move.

**It needs one table.** Run this once in the Supabase SQL editor, or sign-in
works and every save operation fails with "the player_saves table is missing":

```sql
create table if not exists player_saves (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table player_saves enable row level security;
create policy "own save read"   on player_saves for select using (auth.uid() = user_id);
create policy "own save write"  on player_saves for insert with check (auth.uid() = user_id);
create policy "own save update" on player_saves for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**RLS is not optional.** Without those policies the anon key — which ships in
the client bundle, by design — can read every row in the table. Every player's
save would be public, and one of them is the owner's.

No new env vars: it reuses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, so
configuring online play configures this too. It builds its own client rather
than sharing `online.ts`'s, which documents itself as "no DB, no auth" — sharing
one would mean signing in silently changes the key a PvP channel authenticates
with.

Four decisions worth not re-litigating:

- **Link AND code, because which one arrives is not the app's choice.**
  Supabase gates email-template editing behind CUSTOM SMTP, and the built-in
  mailer's default template carries `{{ .ConfirmationURL }}` and no
  `{{ .Token }}` — so on the built-in sender there is no six-digit code in
  existence, whatever the form asks for. `detectSessionInUrl` redeems a link,
  `verifyCode` redeems a code, both are live. **The code is the better flow and
  the one to move to**: a link tapped on a phone opens the default browser,
  which for a home-screen PWA is not the app, so the player ends up signed in
  inside Safari looking at a copy of the game with none of their progress.
  Custom SMTP unlocks it — and also removes the built-in mailer's 2-4
  emails/hour cap, which no real player base survives.
- **Site URL and Redirect URLs must point at the deploy.** They ship as
  `http://localhost:3000` and empty, which is why the first link anyone clicked
  went nowhere. Site URL is now `https://war-element.com`, with BOTH
  `https://war-element.com/**` and `https://war-element.vercel.app/**`
  allow-listed so the old address keeps working. `requestCode` also sends
  `emailRedirectTo: window.location.origin`; an origin that is not allow-listed
  is ignored and Site URL is used instead, so a dev server falls back safely.
- **The half-finished sign-in is PERSISTED, and that is a fix rather than a
  nicety.** Reading the emailed code means leaving the app; the panel is mounted
  as `{accountOpen && <AccountPanel/>}` so closing it destroys `email`/`sent`/
  `code`, and on iOS a backgrounded tab is evicted and the page reloads.
  Players came back to a blank email form with no code box, asked for another
  code, tripped Supabase's ONE-PER-MINUTE send limit, and read the red line at
  the bottom of the modal — below the fold on a phone — as nothing happening.
  Reported as "I get the code, enter it, click sign in and it won't"; the auth
  logs showed every `/verify` that ever reached the server succeeding, with all
  the ERRORs on `/otp`. `pendingSignIn()` / `setPendingSignIn()` /
  `resendWaitMs()` in `account.ts` hold `{email, requestedAt}` in
  `we_signin_pending`, expiring after an hour along with the code they point
  at. A cooldown is surfaced as "your code is already in your inbox", not as an
  error, and Resend counts down instead of silently refusing — mashing it
  invalidates the code the player already has. **When debugging sign-in, read
  Supabase's auth logs first**: `/otp` is requesting a code and `/verify` is
  redeeming one, and which of the two is erroring splits the diagnosis in half.
- **One account per ADDRESS, and nothing reconciles two.** A player who gives
  up on one email and tries another gets a second account with its own separate
  save, silently. That is what "Use a different email" on the code screen is
  defending against; there is no merge, and joining two after the fact means
  restoring one onto a device and re-uploading it under the other.
- **No passwords, ever.** The app never sees, stores or transmits one. There is
  nothing to leak.
- **NEWEST-WINS IS THE WRONG RULE** and it is the one that looks safest. A fresh
  install has a *newer* empty save than a two-month campaign in the cloud, so
  "keep the most recent" deletes everything. What is automatic is one-directional
  — an empty side never overwrites a full one — and when both sides hold real
  progress the panel shows both (cards, nodes, shards, squads, when, which
  device) and makes the player choose.
- **Restore replaces, it does not merge.** Keys absent from the incoming bundle
  are REMOVED, so restoring a save with no squads does not leave the previous
  player's squads behind. After a restore the phone looks like the save rather
  than like a mixture of two. `AccountPanel` then reloads the page, because four
  different modules read those keys at boot and re-seeding them by hand is four
  chances to miss one.

`we_music_muted` is deliberately NOT synced: it is a property of the device, and
carrying it would mean muting the game on a phone because it was muted on a
laptop. Progress travels; preferences stay.

## Anonymous play events — `net/telemetry.ts`, `public.play_events`

Owner, 2026-10-06: "how many people have tried the game?" Supabase only knew
the 3 sign-in accounts (all ours) — the game is local-first. Now each device
gets a random id (`we_device_id` in localStorage; no name, email or account)
and sends a few milestones:

- `first_open` (detail `new` = fresh save / `returning`), `day_open` (once a
  day), `tutorial_done` (detail first|training) / `tutorial_skip`
  (start|mid) / `magic_done`, `first_pack`, `story_win` / `story_loss`
  (detail = node id, lower-case: how far players get, where they lose).
- **The first battle, step by step (2026-10-15):** `tutorial_start`, then
  `tutorial_beat` with the beat id as detail (`hand_birch`, `place_birch`,
  ... `hit_3`; hyphens become underscores) each time the first-run lesson reaches a
  new beat, and `story_start` (node id) when a story fight begins. A device's
  furthest `tutorial_beat` is where it stopped. Training Ground replays do not
  count (`from === "first"` only). Query: `select detail, count(distinct
  device_id) from play_events where event='tutorial_beat' group by 1;` read in
  `BEATS` order.
- Each is sent ONCE per device per detail (`day_open` once a day); queued in
  `we_events_pending` and retried on the next call / `online` event if a send
  fails; the queue drains fully per flush (capped at 50). 409 = already there.
- Plain `fetch` to `/rest/v1/play_events` with the anon key and
  `Prefer: return=minimal` — NOT the Supabase SDK (it stays off the first
  frame). Off when `import.meta.env.DEV` or MODE test: dev and preview runs
  are not players (a `vite build` served locally with real env DOES send).
- **DB** (migrations `play_events_anonymous_log` + `..._unique_with_detail`):
  RLS insert-only for anon/authenticated, column grants (device_id, event,
  detail) so day/created_at are the server's; event `^[a-z0-9_]{1,32}$`,
  detail `^[a-z0-9_]{1,24}$` — a new event needs no migration, just add it to
  `PLAY_EVENTS`. Unique (device, event, coalesce(detail,''), day). Nobody but
  the owner reads it. Read-outs (dashboard Table Editor / SQL): views
  `play_funnel` (devices per event+detail) and `play_daily` (players / new
  players per day), security_invoker with grants revoked.
- Google Play's Data safety form (and the privacy policy, not written yet)
  must declare it: device or other IDs + app interactions, collected, not
  shared, not linked to the user, used for analytics.

## Rejoining an online match — `net/resume.ts` + the `sync` handshake

Online has no server copy of a match (Realtime broadcast, "no DB, no auth"), so a
closed tab or a killed phone app used to end that client's match with no way back
into the room. Now:

- **Every state of a live online match is saved on this device** under
  `we_online_match_v1`: room code, role, seat, the host-issued `clientId`, the
  newest state AND the Lamport clock it came under (`Room.snapshot()`), plus the
  host's rematch `setup`. Read from the ROOM, not from `game` — only the transport
  knows the clock. Cleared on game over, on Leave, and when the player opens or
  joins a different room; expires after `RESUME_TTL_MS` (2h). Device-local on
  purpose and NOT in `SAVE_KEYS`: a seat at a table is not progress, and synced to
  another device it would offer a seat still occupied here.
- **On boot a saved match is offered** by `.rejoin-prompt`, docked above the
  bottom nav on any menu and never mid-match: Rejoin / Leave. `rejoinOnline`
  brings the board up on the saved state at once and restores the seat refs.
- **`joinRoom(code, role, handlers, resume)`** starts the client from that state
  and clock. On every SUBSCRIBED with a state in hand (a rejoin, or a socket that
  dropped and came back) it re-pushes its copy at its ORIGINAL clock, then sends
  `sync` carrying that clock. Everyone holding a state who is NOT behind it
  answers with its newest under a FRESH tick: a client back on an older save
  already matches the room's clock, so an answer at that clock would be "not
  newer" and ignored for good. Everyone who IS behind stays quiet — the asker's
  copy is the newer one (its last move never went out), and an answer would
  spend the very tick that copy needs, so an ask that landed before the copy
  would split the two boards for good. Pinned against an in-memory Realtime in
  `online-rejoin.test.ts`: guest back, host back, both back in either order, a
  lost last move, an ask landing before its copy, `fresh` never replayed.
- **`resend` repeats the NEWEST state, not the last one this client sent.** The
  old rule went stale the moment the other side moved, so a client that came back
  behind heard the host repeat a state it already had, forever.
- **The player left at the table is told** (`.table-quiet`) once nothing has
  arrived for 10s — `Room.quietFor()`; every live client heartbeats every 2.5s —
  so they wait rather than leave.

Not handled: the same seat open in two tabs at once (both would drive it), and a
save from before a deploy that changed the GameState shape (the `sync` answer
normally replaces it with the other side's copy).

## Replays and match history — `engine/replay.ts`, `ui/replay-recorder.ts`, `data/match-history.ts`

A replay is the opening state plus the steps (`Intent` or a run of `advance`
calls, stored as a number), re-run through the pure reducer. `finalHash`
(FNV-1a of the last state's JSON) tells the viewer when a later build plays it
out differently; it says so instead of passing it off as the real match.

- **Recording.** The App moves the live match only through `recApply` /
  `recAdvance` (dispatch, the AI auto-advance, the all-auto sweep). Each new
  state is tagged with the step that made it; the recorder (`MatchRecorder`,
  fed every state that LANDS via an effect on `game`) walks the tags back to
  the last state it logged, so a staged cast that never landed is never logged
  and React rendering only the last of several states loses nothing. A new
  engine call that moves the live game must go through `recApply` /
  `recAdvance`, or every match after it saves without a replay.
- **What breaks a recording.** Any state the tags cannot explain: a state from
  the other player online, a rejoin. A fresh deal (mulligan, nobody kept)
  starts a new one. Online matches go to history marked "No replay (online)":
  the guest's moves arrive as finished states, so v1 has no recipe for them.
- **Storage.** Last 30 matches (`we_match_history_v1`), replays apart
  (`we_replay_v1_<id>`, ~7 KB each) so a full storage drops the oldest replays,
  never the rows. Share codes are gzip+base64 (`WER1.` prefix, ~1.5 KB) and
  carry the title and seat names in `replay.meta`.
- **UI.** Result screen "Watch replay"; Arena hub "Match history" (watch, copy
  code, delete, paste a code). `ReplayViewer` renders the real `Board` and keeps
  a snapshot every 20 steps, re-running forward from the nearest when scrubbing.
- Pinned by `replay.test.ts` (whole AI-vs-AI matches replay to the same hash
  from a JSON round trip; share code round-trips) and `replay-recorder.test.ts`.
