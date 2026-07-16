# Running War Element (PC)

## Fastest way — double-click

Double-click **`start-game.bat`** in this folder. It starts the dev server and
opens the game in your browser automatically. Leave that window open while you
play; close it (or press **Ctrl+C**) to stop the server.

> Tip: right-click `start-game.bat` → **Send to → Desktop (create shortcut)** so
> you can launch it from the desktop.

## Manual way

Open PowerShell / Terminal and run:

```powershell
cd C:\Users\IlIKingPin\war-element
npm run dev
```

Then open the URL it prints — **http://localhost:5173** — in your browser.
Edits hot-reload automatically. Press **Ctrl+C** in the terminal to stop.

## First time, or after a `git pull` (or if it errors about missing modules)

Install dependencies once:

```powershell
cd C:\Users\IlIKingPin\war-element
npm install
```

## Fixed port (optional)

`npm run dev` uses Vite's default **5173**. To pin it to **5199** instead
(handy if 5173 is taken):

```powershell
npm run dev -- --port 5199 --strictPort
```

Then open **http://localhost:5199**.

## Online PvP with a buddy (optional)

Play head-to-head over the internet. Two one-time setups, then it's a room code.

### 1. Supabase (the move-sync channel) — free, ~3 min

1. Go to **supabase.com** → sign in → **New project** (any name; free tier).
2. Open the project → **Settings → API**. Copy the **Project URL** and the
   **anon public** key.
3. In this folder, copy `.env.example` to **`.env.local`** and paste them in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```
   (No tables or auth needed — we only use Realtime broadcast. `.env.local` is
   gitignored.) Restart `npm run dev` after saving.

### 2. Deploy so you both can reach it — Vercel, free

Your buddy can't hit your `localhost`, so put the app online once:

1. Push this repo to GitHub, then at **vercel.com** → **Add New → Project** →
   import the repo. Framework auto-detects as **Vite** (build `npm run build`,
   output `dist`). No `vercel.json` needed.
2. In Vercel → **Settings → Environment Variables**, add the same
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy. You get a URL
   like `https://war-element.vercel.app`.

### 3. Play

Both people open the Vercel URL and pick **🌐 Online** on the start screen:

- **You (host):** click **Host game**, pick your deck, **Create room** → share
  the shown room **code**. You're **P1**.
- **Buddy (guest):** click **Join game**, type the **code**, pick their deck,
  **Join room**. They're **P2**.

The match starts when they join. You only get controls on **your** turn (the
other side shows "⏳ waiting…"); everything syncs automatically. If it desyncs,
both hit **New game** and re-create the room.

> Testing locally instead of deploying? Run `npm run dev -- --host` and expose
> your PC with a tunnel (`cloudflared tunnel --url http://localhost:5199` or
> `ngrok http 5199`); your buddy opens the tunnel URL. The Supabase step is the
> same.

## Cheat sheet

| Goal | Command |
|------|---------|
| Start the game | double-click `start-game.bat`, or `npm run dev` → http://localhost:5173 |
| Stop it | Ctrl+C in the terminal window |
| After a `git pull` / errors | `npm install` first |
| Type-check | `npx tsc --noEmit` |
| Run tests | `npx vitest run` |

**One line to remember:** `cd C:\Users\IlIKingPin\war-element` then `npm run dev`.
