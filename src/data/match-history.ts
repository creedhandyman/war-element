/** MATCH HISTORY — the last finished matches on this device, with their replays.
 *
 *  Summaries and replays are stored apart: the list is small and always kept,
 *  a replay is a few kilobytes and is the first thing dropped if storage runs
 *  short. Losing a replay leaves its row in the history, marked as such, rather
 *  than taking the record of the match with it.
 */
import type { PlayerId } from "../engine";
import type { Replay } from "../engine/replay";

export const HISTORY_MAX = 30;
const LIST_KEY = "we_match_history_v1";
const REPLAY_KEY = (id: string) => `we_replay_v1_${id}`;

export interface MatchSummary {
  id: string;
  /** Epoch ms the match ended. */
  at: number;
  /** "Arena", "Story · Cherry Grove Path", "Training · Statuses", … */
  mode: string;
  /** What each seat was called in the intro (deck or foe name). */
  names: Partial<Record<PlayerId, string>>;
  /** The viewer's seat. */
  me: PlayerId;
  winner: PlayerId | null;
  by: string;
  rounds: number;
  mvp?: string;
  /** False for a match that could not be recorded (online). */
  replayable: boolean;
}

function read(): MatchSummary[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    const list = raw ? (JSON.parse(raw) as MatchSummary[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: MatchSummary[]): void {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* full — the list stays as it was */ }
}

/** Newest first. */
export const loadHistory = (): MatchSummary[] => read();

export function loadReplay(id: string): Replay | null {
  try {
    const raw = localStorage.getItem(REPLAY_KEY(id));
    return raw ? (JSON.parse(raw) as Replay) : null;
  } catch {
    return null;
  }
}

/** Is this match's replay still on the device? */
export function hasReplay(id: string): boolean {
  try { return localStorage.getItem(REPLAY_KEY(id)) !== null; } catch { return false; }
}

/** Record a finished match. Trims to HISTORY_MAX, and on a full storage drops
 *  the oldest replays until this one fits (or there is nothing left to drop). */
export function saveMatch(summary: MatchSummary, replay: Replay | null): void {
  const list = [summary, ...read().filter((m) => m.id !== summary.id)];
  for (const old of list.slice(HISTORY_MAX)) {
    try { localStorage.removeItem(REPLAY_KEY(old.id)); } catch { /* ignore */ }
  }
  const kept = list.slice(0, HISTORY_MAX);
  write(kept);
  if (!replay) return;
  const body = JSON.stringify(replay);
  for (let i = kept.length - 1; i >= 0; i--) {
    try {
      localStorage.setItem(REPLAY_KEY(summary.id), body);
      return;
    } catch {
      // Full: let the oldest stored replay go and try again.
      if (kept[i].id === summary.id) return;
      try { localStorage.removeItem(REPLAY_KEY(kept[i].id)); } catch { /* ignore */ }
    }
  }
}

export function deleteMatch(id: string): void {
  write(read().filter((m) => m.id !== id));
  try { localStorage.removeItem(REPLAY_KEY(id)); } catch { /* ignore */ }
}

export const newMatchId = (): string =>
  `m_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
