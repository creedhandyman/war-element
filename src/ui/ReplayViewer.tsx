/** WATCH A MATCH BACK — the board, re-run from its recipe (engine/replay.ts).
 *
 *  Nothing here plays the game: every frame is `applyIntent`/`advance` over the
 *  recorded steps, so what is shown is the match as it happened, at whatever
 *  pace the viewer likes. Memory stays flat on a long match by keeping a
 *  snapshot every KEY_EVERY steps and re-running forward from the nearest one
 *  when the scrubber jumps.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, PlayerId } from "../engine";
import { applyOp, cloneState, encodeReplay, expandSteps, stateHash, type Replay } from "../engine/replay";
import { Board } from "./Board";
import { strikeZone } from "./attack-zone";
import { MatchReport } from "./MatchReport";

const KEY_EVERY = 20;
const SPEEDS = [1, 2, 4] as const;
const BASE_MS = 520;
const NO_POS: never[] = [];
const NO_COUNTS: Record<string, number> = {};
const NO_IDS = new Set<string>();
const noop = () => {};

export interface ReplayMeta {
  title: string;
  names?: Partial<Record<PlayerId, string>>;
  me: PlayerId;
}

const PHASE_LABEL: Record<string, string> = {
  mulligan: "Mulligan", draw: "Draw", resource: "Resource", prep: "Prep",
  battle: "Battle", cleanup: "Cleanup", gameover: "Game over",
};

export function ReplayViewer(props: { replay: Replay; meta: ReplayMeta; onClose: () => void }) {
  const { replay, meta } = props;
  const ops = useMemo(() => expandSteps(replay.steps), [replay]);

  // One pass to find the end, the snapshots, and whether this build plays the
  // match out the way it was recorded.
  const run = useMemo(() => {
    const keys = new Map<number, GameState>();
    let s = cloneState(replay.initial);
    keys.set(0, s);
    let brokeAt: number | null = null;
    for (let i = 0; i < ops.length; i++) {
      try {
        s = applyOp(s, ops[i]);
      } catch {
        brokeAt = i;
        break;
      }
      if ((i + 1) % KEY_EVERY === 0) keys.set(i + 1, s);
    }
    const last = brokeAt ?? ops.length;
    keys.set(last, s);
    return { keys, last, brokeAt, matches: brokeAt === null && stateHash(s) === replay.finalHash };
  }, [replay, ops]);

  const stateAt = (i: number): GameState => {
    let k = Math.floor(i / KEY_EVERY) * KEY_EVERY;
    while (!run.keys.has(k)) k -= KEY_EVERY;
    let s = run.keys.get(k)!;
    for (let j = k; j < i; j++) s = applyOp(s, ops[j]);
    return s;
  };

  const [step, setStep] = useState(0);
  const [frame, setFrame] = useState<{ prev: GameState | null; cur: GameState }>(() => ({ prev: null, cur: run.keys.get(0)! }));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");

  /** Go to step `i`: one step on is applied to the frame on screen (so the
   *  strike it threw lights up); anything else is a jump. */
  const goTo = (i: number) => {
    const to = Math.max(0, Math.min(run.last, i));
    if (to === step) return;
    if (to === step + 1) setFrame((f) => ({ prev: f.cur, cur: applyOp(f.cur, ops[step]) }));
    else setFrame({ prev: null, cur: stateAt(to) });
    setStep(to);
  };

  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!playing) return;
    if (step >= run.last) { setPlaying(false); return; }
    const t = window.setTimeout(() => goTo(stepRef.current + 1), BASE_MS / speed);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo reads the latest step through the ref
  }, [playing, step, speed]);

  const cur = frame.cur;
  const strike = frame.prev ? strikeZone(frame.prev, cur) : null;
  const atEnd = step >= run.last;
  const name = (p: PlayerId) => meta.names?.[p] ?? (p === meta.me ? "You" : "Opponent");
  const log = cur.log.slice(-6);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(await encodeReplay(replay));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  };

  return (
    <div className="overlay on-top rv-overlay">
      <div className="rv" role="dialog" aria-label={`Replay — ${meta.title}`}>
        <div className="rv-head">
          <div className="rv-title">
            <b>{meta.title}</b>
            <span>{name("P1")} vs {name("P2")}</span>
          </div>
          <button className="ghost sm" onClick={props.onClose}>Close</button>
        </div>

        {!run.matches && (
          <p className="rv-warn">
            {run.brokeAt !== null
              ? `Recorded on an older version of the game: it stops at step ${run.brokeAt + 1}, where a move is no longer legal.`
              : "Recorded on an older version of the game: cards or rules have changed since, so it may play out differently from the real match."}
          </p>
        )}

        <div className="rv-stage">
          <div className="rv-board">
            <Board
              game={cur}
              legalSlots={NO_POS}
              legalTargetIds={NO_POS}
              targetsAreEnemies
              previewArea={NO_POS}
              aimArea={NO_POS}
              blast={NO_POS}
              strike={strike}
              telegraphs={NO_POS}
              stagedSlot={null}
              pickCounts={NO_COUNTS}
              hasSelection={false}
              movableIds={NO_IDS}
              selectedId={null}
              actingId={cur.battle?.awaitingInput ?? null}
              grayTeam={null}
              viewPlayer={meta.me}
              onSlotClick={noop}
              onSlotDragOver={noop}
              onSlotDrop={noop}
            />
          </div>
          <div className="rv-side">
            <div className="rv-where">
              Round <b>{cur.round}</b> · {PHASE_LABEL[cur.phase] ?? cur.phase}
            </div>
            <ol className="rv-log">
              {log.map((l, i) => <li key={`${cur.log.length}-${i}`}>{l}</li>)}
            </ol>
          </div>
        </div>

        <div className="rv-controls">
          <button className="ghost sm" onClick={() => { setPlaying(false); goTo(0); }} aria-label="Back to the start">⏮</button>
          <button className="ghost sm" onClick={() => { setPlaying(false); goTo(step - 1); }} aria-label="Step back">◀</button>
          <button className="lockin sm" onClick={() => (atEnd ? (goTo(0), setPlaying(true)) : setPlaying((p) => !p))}>
            {playing ? "Pause" : atEnd ? "Replay" : "Play"}
          </button>
          <button className="ghost sm" onClick={() => { setPlaying(false); goTo(step + 1); }} aria-label="Step forward">▶</button>
          <button className="ghost sm" onClick={() => { setPlaying(false); goTo(run.last); }} aria-label="Jump to the end">⏭</button>
          <button className="ghost sm rv-speed" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}>
            {speed}×
          </button>
        </div>
        <input
          className="rv-scrub"
          type="range"
          min={0}
          max={run.last}
          value={step}
          onChange={(e) => { setPlaying(false); goTo(Number(e.target.value)); }}
          aria-label="Replay position"
        />
        <div className="rv-foot">
          <span>Step {step} / {run.last}</span>
          <button className="ghost sm" onClick={share}>
            {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy replay code"}
          </button>
        </div>

        {atEnd && cur.win && <MatchReport game={cur} me={meta.me} />}
      </div>
    </div>
  );
}
