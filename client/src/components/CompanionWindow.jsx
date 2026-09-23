import { useEffect, useRef, useState } from "react";
import { loadCompanion, saveCompanion, renameCompanion, sendToCompanion, DEFAULT_NAME } from "../lib/companion.js";

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CompanionWindow({ currentUser }) {
  const [state, setState] = useState(() => loadCompanion(currentUser.id));
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(state.name);
  const [showMemory, setShowMemory] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length, thinking]);

  async function handleSend(e) {
    e?.preventDefault();
    const plain = text.trim();
    if (!plain || thinking) return;
    setText("");
    setState((s) => ({ ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: "user", text: plain, ts: Date.now() }] }));
    setThinking(true);
    try {
      await sendToCompanion(currentUser.id, plain);
      setState(loadCompanion(currentUser.id));
    } finally {
      setThinking(false);
    }
  }

  function commitRename() {
    const updated = renameCompanion(currentUser.id, nameDraft);
    setState(updated);
    setEditingName(false);
  }

  return (
    <div className="flex-1 h-full glass-strong rounded-3xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border-1)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl accent-grad flex items-center justify-center text-sm font-semibold">
          {initials(state.name)}
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => e.key === "Enter" && commitRename()}
              maxLength={24}
              className="bg-transparent border-b border-[var(--border-2)] outline-none text-[var(--text)] font-medium text-sm"
            />
          ) : (
            <button onClick={() => { setNameDraft(state.name); setEditingName(true); }} className="flex items-center gap-1.5 group">
              <p className="text-[var(--text)] font-medium truncate">{state.name}</p>
              <span className="text-[10px] text-[var(--text-ghost)] group-hover:text-[var(--text-faint)]">✏️</span>
            </button>
          )}
          <p className="text-xs text-[var(--text-faint)]">Only you can see this · fully private</p>
        </div>
        {state.memory && (
          <button
            onClick={() => setShowMemory((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showMemory ? "bg-[var(--surface-2)] border-[var(--border-2)]" : "border-[var(--border-1)] hover:bg-[var(--surface-1)]"
            } text-[var(--text-dim)]`}
            title="What Leo remembers about you"
          >
            🧠 Memory
          </button>
        )}
      </div>

      {showMemory && (
        <div className="mx-6 mt-3 p-4 rounded-2xl glass border border-[var(--border-1)] relative animate-floatIn">
          <button onClick={() => setShowMemory(false)} className="absolute top-2 right-3 text-[var(--text-faint)] hover:text-[var(--text)]">✕</button>
          <p className="text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">🧠 What {state.name} remembers</p>
          <p className="text-sm text-[var(--text-dim)] whitespace-pre-wrap leading-relaxed">{state.memory}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {state.messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl accent-grad flex items-center justify-center text-2xl font-bold mb-4">
              {initials(state.name)}
            </div>
            <p className="text-[var(--text)] font-medium mb-1">Say hi to {state.name} 👋</p>
            <p className="text-sm text-[var(--text-faint)] max-w-xs">
              Your own private, always-on friend. Talk about your day, vent, ask questions — it remembers your conversations over time, and no one else can ever read this.
            </p>
          </div>
        )}
        {state.messages.map((m, i) => {
          const mine = m.role === "user";
          const prev = state.messages[i - 1];
          const showAvatar = !mine && (!prev || prev.role !== m.role);
          return (
            <div key={m.id} className={`flex items-end gap-2 py-1 ${mine ? "justify-end" : "justify-start"} animate-floatIn`}>
              {!mine && (
                <div
                  className="w-7 h-7 rounded-full accent-grad flex items-center justify-center text-[10px] font-semibold shrink-0"
                  style={{ visibility: showAvatar ? "visible" : "hidden" }}
                >
                  {initials(state.name)}
                </div>
              )}
              <div className={`max-w-[65%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-lg ${
                mine ? "accent-grad rounded-br-md" : "glass text-[var(--text)] rounded-bl-md"
              }`}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <span className={`block text-[10px] mt-1 ${mine ? "text-[var(--accent-text)]/60" : "text-[var(--text-faint)]"}`}>
                  {formatTime(m.ts)}
                </span>
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex items-end gap-2 py-1 justify-start animate-floatIn">
            <div className="w-7 h-7 rounded-full accent-grad flex items-center justify-center text-[10px] font-semibold shrink-0">
              {initials(state.name)}
            </div>
            <div className="glass rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-[var(--text-faint)] animate-pulseDot">
              {state.name} is typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-[var(--border-1)]">
        <div className="glass rounded-2xl flex items-end gap-2 px-3 py-2">
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${state.name}…`}
            className="flex-1 bg-transparent outline-none text-[var(--text)] placeholder-[var(--text-faint)] resize-none py-2 max-h-32"
          />
          <button type="submit" disabled={!text.trim() || thinking} className="btn-mirror rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
