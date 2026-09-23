import { useState } from "react";
import { avatarTextColor } from "../lib/color.js";

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function shareableUrl() {
  const { hostname, protocol, port } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}

export default function NewChatModal({ users, currentUser, onClose, onSelectUser, onCreateGroup }) {
  const [mode, setMode] = useState("chat"); // 'chat' | 'group'
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState([]);
  const [copied, setCopied] = useState(false);
  const others = users.filter((u) => u.id !== currentUser.id);
  const url = shareableUrl();

  function handleCopy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function toggleMember(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCreateGroup() {
    if (!groupName.trim() || selected.length === 0) return;
    onCreateGroup(groupName.trim(), selected);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="glass-strong rounded-3xl p-6 w-full max-w-sm mono-glow animate-floatIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-[var(--surface-1)] rounded-xl p-1">
            <button
              onClick={() => setMode("chat")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === "chat" ? "accent-grad" : "text-[var(--text-dim)]"}`}
            >
              New Chat
            </button>
            <button
              onClick={() => setMode("group")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === "group" ? "accent-grad" : "text-[var(--text-dim)]"}`}
            >
              New Group
            </button>
          </div>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)]">✕</button>
        </div>

        {mode === "group" && (
          <input
            autoFocus
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            maxLength={40}
            className="w-full premium-input rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] outline-none mb-3"
          />
        )}

        <div className="max-h-64 overflow-y-auto space-y-1">
          {others.length === 0 && (
            <div className="py-6 px-2 text-center">
              <p className="text-2xl mb-2">📡</p>
              <p className="text-sm text-[var(--text-dim)] mb-1">Nobody's joined yet</p>
              <p className="text-xs text-[var(--text-faint)] mb-3">
                There's no "add user" step — anyone who opens this app on the same Wi-Fi and picks a username shows up here automatically.
              </p>
              {url ? (
                <button
                  onClick={handleCopy}
                  className="text-xs px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border-1)] text-[var(--text-dim)] hover:bg-[var(--surface-2)] transition-colors font-mono"
                >
                  {copied ? "Copied!" : `📋 ${url}`}
                </button>
              ) : (
                <p className="text-[11px] text-[var(--text-ghost)]">
                  Find your laptop's IP with <code className="text-[var(--text-faint)]">ipconfig</code>, then share <code className="text-[var(--text-faint)]">http://&lt;that-ip&gt;:5173</code> with others on your Wi-Fi.
                </p>
              )}
            </div>
          )}
          {others.map((u) => {
            const isSelected = selected.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => (mode === "chat" ? onSelectUser(u) : toggleMember(u.id))}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                  isSelected ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-1)]"
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: u.avatar_color, color: avatarTextColor(u.avatar_color) }}
                >
                  {initials(u.username)}
                </div>
                <span className="text-sm text-[var(--text)] flex-1 text-left truncate">{u.username}</span>
                {mode === "group" && (
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                      isSelected ? "accent-grad border-transparent" : "border-[var(--border-2)]"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {mode === "group" && (
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selected.length === 0}
            className="btn-mirror w-full rounded-xl font-semibold py-2.5 mt-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Group {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
        )}
      </div>
    </div>
  );
}
