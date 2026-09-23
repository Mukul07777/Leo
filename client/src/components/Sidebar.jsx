function initials(name) {
  return name.slice(0, 2).toUpperCase();
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

export default function Sidebar({ currentUser, rooms, users, onlineIds, activeRoomId, onSelectRoom, onSelectUser, onLogout }) {
  return (
    <div className="w-80 h-full glass-strong rounded-3xl flex flex-col overflow-hidden shrink-0">
      <div className="p-5 flex items-center gap-3 border-b border-white/5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-black mono-glow"
          style={{ background: currentUser.avatar_color }}
        >
          {initials(currentUser.username)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{currentUser.username}</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseDot" /> online
          </p>
        </div>
        <button
          onClick={onLogout}
          className="text-white/30 hover:text-white/70 text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          Exit
        </button>
      </div>

      <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-white/30">Rooms</div>
      <div className="px-2 max-h-[35%] overflow-y-auto">
        {rooms.filter((r) => !r.is_dm).map((room) => (
          <button
            key={room.id}
            onClick={() => onSelectRoom(room.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all flex items-center gap-3 ${
              activeRoomId === room.id ? "bg-white/10 mono-glow" : "hover:bg-white/5"
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center text-sm">
              #
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/90 text-sm font-medium truncate">{room.displayName}</p>
              <p className="text-white/35 text-xs truncate">{room.lastMsg?.body || "No messages yet"}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-white/30">Direct Messages</div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {users.filter((u) => u.id !== currentUser.id).map((u) => {
          const dmRoom = rooms.find((r) => r.is_dm && r.displayName === u.username);
          const isOnline = onlineIds.includes(u.id);
          return (
            <button
              key={u.id}
              onClick={() => onSelectUser(u)}
              className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all flex items-center gap-3 ${
                dmRoom && activeRoomId === dmRoom.id ? "bg-white/10 mono-glow" : "hover:bg-white/5"
              }`}
            >
              <div className="relative">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-black"
                  style={{ background: u.avatar_color }}
                >
                  {initials(u.username)}
                </div>
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#12121a]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/90 text-sm font-medium truncate">{u.username}</p>
                <p className="text-white/35 text-xs truncate">
                  {dmRoom?.lastMsg?.body || (isOnline ? "Online" : `Last seen ${timeAgo(u.last_seen)}`)}
                </p>
              </div>
            </button>
          );
        })}
        {users.length <= 1 && (
          <p className="text-white/25 text-xs px-3 py-4">No other users yet — open the app on another device to see them here.</p>
        )}
      </div>
    </div>
  );
}
