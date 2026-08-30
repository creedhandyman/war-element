import { useEffect, useRef, useState } from "react";
import type { PlayerId } from "../engine";
import { CHAT_MAX, type ChatMsg } from "../net/online";
import { SEAT_SUIT } from "./shared";

/** Table talk for an online match.
 *
 *  Every line is somebody else's typing, so it goes in as TEXT — interpolated
 *  by React, never `dangerouslySetInnerHTML`, and never through the log's
 *  `<b>`-parsing hint path. The wire pass in `sanitizeChat` fixes the shape;
 *  this renders it.
 *
 *  Canned phrases sit above the input because the input is the hard part on a
 *  phone: it is your opponent's turn, you have one hand on the board, and
 *  typing "good game" costs more attention than the game is worth. Three taps
 *  cover most of what anyone says during a match. */
export function ChatPanel({
  messages, mySeat, seatNames, onSend, open, onOpenChange, unread,
}: {
  messages: ChatMsg[];
  mySeat: PlayerId;
  seatNames?: Partial<Record<PlayerId, string>>;
  onSend: (text: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unread: number;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Pin to the newest line whenever one arrives or the panel opens. Reading
  // chat means reading the bottom of it.
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    // Keep focus: a match is a burst of short lines, not one message.
    inputRef.current?.focus();
  }

  if (!open) {
    return (
      <button
        className="chat-fab"
        onClick={() => onOpenChange(true)}
        aria-label={unread ? `Chat, ${unread} unread` : "Chat"}
        title="Chat"
      >
        <Bubble />
        {unread > 0 && <span className="chat-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>
    );
  }

  return (
    <div className="chat-wrap" role="dialog" aria-label="Match chat">
      <div className="chat-head">
        <span className="chat-title"><Bubble /> Chat</span>
        <button className="chat-x" onClick={() => onOpenChange(false)} aria-label="Close chat">✕</button>
      </div>

      <div className="chat-log">
        {messages.length === 0 && <div className="chat-empty">Say something to the table.</div>}
        {messages.map((m) => {
          const suit = SEAT_SUIT[m.seat];
          return (
            <div key={m.id} className={`chat-line${m.seat === mySeat ? " mine" : ""}`}>
              <span className={`chat-who suit-${suit.key}`}>
                {suit.glyph} {seatNames?.[m.seat] ?? m.seat}
              </span>
              {/* Interpolated, so it is escaped. Never innerHTML. */}
              <span className="chat-text">{m.text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="chat-quick">
        {["Good luck!", "Nice move.", "Good game!", "One sec…"].map((q) => (
          <button key={q} className="chat-chip" onClick={() => onSend(q)}>{q}</button>
        ))}
      </div>

      <div className="chat-input">
        <input
          ref={inputRef}
          value={draft}
          maxLength={CHAT_MAX}
          placeholder="Message the table…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); send(); }
            if (e.key === "Escape") onOpenChange(false);
          }}
          aria-label="Chat message"
        />
        <button className="chat-send" onClick={send} disabled={!draft.trim()}>Send</button>
      </div>
    </div>
  );
}

function Bubble() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.3A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
    </svg>
  );
}
