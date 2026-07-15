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

## Cheat sheet

| Goal | Command |
|------|---------|
| Start the game | double-click `start-game.bat`, or `npm run dev` → http://localhost:5173 |
| Stop it | Ctrl+C in the terminal window |
| After a `git pull` / errors | `npm install` first |
| Type-check | `npx tsc --noEmit` |
| Run tests | `npx vitest run` |

**One line to remember:** `cd C:\Users\IlIKingPin\war-element` then `npm run dev`.
