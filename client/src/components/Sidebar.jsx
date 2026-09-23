import { useState } from "react";
import SettingsPanel from "./SettingsPanel.jsx";
import NewChatModal from "./NewChatModal.jsx";
import { loadCompanion } from "../lib/companion.js";

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function lastMsgPreview(lastMsg) {
  if (!lastMsg) return null;
  if (lastMsg.deleted) return "message deleted";
  if (lastMsg.cipher) return "🔒 Encrypted message";
  if (lastMsg.body) return lastMsg.body;
  if (lastMsg.voice_duration != null) return "🎙 Voice message";
  if (lastMsg.file_name) return `📎 ${lastMsg.file_name}`;
  return null;
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export default function Sidebar({
  currentUser, rooms, users, onlineIds, activeRoomId,
  onSelectRoom, onSelectUser, onCreateGroup, onLogout,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const companion = loadCompanion(currentUser.id);
  const companionActive = activeRoomId === "__companion__";
  const companionLastMsg = companion.messages[companion.messages.length - 1];

  const sortedChats = [...rooms].sort((a, b) => {
    const at = a.lastMsg?.created_at || a.created_at;
    const bt = b.lastMsg?.created_at || b.created_at;
    return bt - at;
  });

  function handleSelectUser(u) {
    setShowNewChat(false);
    onSelectUser(u);
  }

  function handleCreateGroup(name, memberIds) {
    setShowNewChat(false);
    onCreateGroup(name, memberIds);
  }

  return (
    <div className="w-80 h-full glass-strong rounded-3xl flex flex-col overflow-hidden shrink-0 relative">
      <div className="p-5 flex items-center gap-3 border-b border-[var(--border-1)]">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-black mono-glow shrink-0 hover:brightness-95 transition-all"
          style={{ background: currentUser.avatar_color }}
          title="Appearance settings"
        >
          {initials(currentUser.username)}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--text)] font-medium truncate">{currentUser.username}</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseDot" /> online
          </p>
        </div>
        <button
          onClick={() => setShowNewChat(true)}
          className="btn-mirror w-9 h-9 rounded-full flex items-center justify-center text-lg font-medium shrink-0"
          title="New chat or group"
        >
          +
        </button>
        <button
          onClick={onLogout}
          className="text-[var(--text-faint)] hover:text-[var(--text-dim)] text-xs px-2 py-1 rounded-lg hover:bg-[var(--surface-1)] transition-colors"
        >
          Exit
        </button>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <div className="px-2 pt-3">
        <button
          onClick={() => onSelectRoom("__companion__")}
          className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all flex items-center gap-3 ${
            companionActive ? "bg-[var(--surface-2)] mono-glow" : "hover:bg-[var(--surface-1)]"
          }`}
        >
          <div className="w-11 h-11 rounded-full accent-grad flex items-center justify-center text-sm font-semibold shrink-0">
            {initials(companion.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[var(--text)] text-sm font-medium truncate">{companion.name}</p>
              <span className="text-[9px] uppercase tracking-wide text-[var(--text-ghost)] border border-[var(--border-1)] rounded-full px-1.5 py-0.5">Private</span>
            </div>
            <p className="text-[var(--text-faint)] text-xs truncate">
              {companionLastMsg ? companionLastMsg.text : "Your personal companion · say hi 👋"}
            </p>
          </div>
        </button>
        <div className="h-px bg-[var(--border-1)] my-2 mx-1" />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {sortedChats.length === 0 && (
          <div className="text-center px-6 py-10">
            <p className="text-3xl mb-3">💬</p>
            <p className="text-sm text-[var(--text-dim)] mb-1">No chats yet</p>
            <p className="text-xs text-[var(--text-faint)]">Tap + to message someone or start a group</p>
          </div>
        )}
        {sortedChats.map((room) => {
          const isOnline = room.is_dm && onlineIds.includes(room.otherUserId);
          const active = activeRoomId === room.id;
          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all flex items-center gap-3 ${
                active ? "bg-[var(--surface-2)] mono-glow" : "hover:bg-[var(--surface-1)]"
              }`}
            >
              <div className="relative shrink-0">
                {room.is_dm ? (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-black"
                    style={{ background: users.find((u) => u.id === room.otherUserId)?.avatar_color || "#a1a1aa" }}
                  >
                    {initials(room.displayName)}
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-full accent-grad flex items-center justify-center text-sm font-semibold">
                    {initials(room.displayName)}
                  </div>
                )}
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--bg-solid)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[var(--text)] text-sm font-medium truncate">{room.displayName}</p>
                  {room.lastMsg && <span className="text-[10px] text-[var(--text-faint)] shrink-0">{timeAgo(room.lastMsg.created_at)}</span>}
                </div>
                <p className="text-[var(--text-faint)] text-xs truncate">
                  {lastMsgPreview(room.lastMsg) || (room.is_dm ? (isOnline ? "Online" : "No messages yet") : `${room.memberCount || 0} members`)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {showNewChat && (
        <NewChatModal
          users={users}
          currentUser={currentUser}
          onClose={() => setShowNewChat(false)}
          onSelectUser={handleSelectUser}
          onCreateGroup={handleCreateGroup}
        />
      )}
    </div>
  );
}
