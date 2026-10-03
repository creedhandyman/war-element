/** MATCH HISTORY — the last finished matches on this device, and a way in to
 *  their replays (data/match-history.ts holds them). Also takes a pasted
 *  replay code, so a shared finish or a bug report can be watched here. */
import { useState } from "react";
import type { PlayerId } from "../engine";
import { decodeReplay, encodeReplay, type Replay } from "../engine/replay";
import { deleteMatch, hasReplay, loadHistory, loadReplay, type MatchSummary } from "../data/match-history";
import type { ReplayMeta } from "./ReplayViewer";

function ago(at: number): string {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const foeOf = (m: MatchSummary): PlayerId => (m.me === "P1" ? "P2" : "P1");

export function MatchHistory(props: { onWatch: (replay: Replay, meta: ReplayMeta) => void; onClose: () => void }) {
  const [list, setList] = useState(() => loadHistory());
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const watch = (m: MatchSummary) => {
    const r = loadReplay(m.id);
    if (r) props.onWatch(r, { title: m.mode, names: m.names, me: m.me });
  };
  const copy = async (m: MatchSummary) => {
    const r = loadReplay(m.id);
    if (!r) return;
    try {
      await navigator.clipboard.writeText(await encodeReplay(r));
      setCopiedId(m.id);
    } catch {
      setNote("Could not copy to the clipboard.");
    }
  };
  const openCode = async () => {
    const r = await decodeReplay(code);
    if (!r) { setNote("That is not a replay code this version can read."); return; }
    props.onWatch(r, r.meta ?? { title: "Shared replay", me: "P1" });
  };

  return (
    <div className="overlay on-top mh-overlay">
      <div className="modal mh" role="dialog" aria-label="Match history">
        <div className="mh-head">
          <h3>Match history</h3>
          <button className="ghost sm" onClick={props.onClose}>Close</button>
        </div>
        <p className="mh-blurb">Your last {list.length || ""} finished matches on this device. Watch one back, or copy its replay code to share it.</p>

        {list.length === 0 ? (
          <p className="mh-empty">No matches yet. Finish one and it shows up here.</p>
        ) : (
          <ul className="mh-list">
            {list.map((m) => {
              const won = m.winner === m.me;
              const result = m.winner === null ? "Draw" : won ? "Won" : "Lost";
              const can = m.replayable && hasReplay(m.id);
              return (
                <li key={m.id} className={`mh-row ${m.winner === null ? "draw" : won ? "won" : "lost"}`}>
                  <div className="mh-main">
                    <span className="mh-result">{result}</span>
                    <span className="mh-mode">{m.mode}</span>
                    <span className="mh-vs">vs {m.names[foeOf(m)] ?? "Opponent"}</span>
                    <span className="mh-meta">
                      Round {m.rounds}{m.mvp ? ` · MVP ${m.mvp}` : ""} · {ago(m.at)}
                    </span>
                  </div>
                  <div className="mh-acts">
                    {can ? (
                      <>
                        <button className="lockin sm" onClick={() => watch(m)}>Watch</button>
                        <button className="ghost sm" onClick={() => copy(m)}>{copiedId === m.id ? "Copied" : "Code"}</button>
                      </>
                    ) : (
                      <span className="mh-none">{m.replayable ? "Replay cleared" : m.mode === "Online" ? "No replay (online)" : "No replay"}</span>
                    )}
                    <button className="ghost sm" aria-label="Delete" onClick={() => { deleteMatch(m.id); setList(loadHistory()); }}>✕</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mh-paste">
          <input
            type="text"
            placeholder="Paste a replay code"
            value={code}
            onChange={(e) => { setCode(e.target.value); setNote(""); }}
          />
          <button className="ghost sm" disabled={!code.trim()} onClick={openCode}>Watch</button>
        </div>
        {note && <p className="mh-note">{note}</p>}
      </div>
    </div>
  );
}
