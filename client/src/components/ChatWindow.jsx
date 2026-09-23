import { useEffect, useRef, useState } from "react";
import { getMessages, uploadFile, API_BASE } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatWindow({ currentUser, room }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socket = getSocket();

  useEffect(() => {
    if (!room) return;
    let active = true;
    getMessages(room.id).then((msgs) => {
      if (active) setMessages(msgs);
    });
    socket.emit("join", room.id);
    setTypingUsers({});

    return () => {
      socket.emit("leave", room.id);
      active = false;
    };
  }, [room?.id]);

  useEffect(() => {
    function onNewMessage(msg) {
      if (msg.room_id !== room?.id) return;
      setMessages((prev) => [...prev, msg]);
      if (msg.user_id !== currentUser.id) {
        socket.emit("read", { roomId: room.id, userId: currentUser.id, messageId: msg.id });
      }
    }
    function onTyping({ userId, username, isTyping }) {
      if (userId === currentUser.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (isTyping) next[userId] = username;
        else delete next[userId];
        return next;
      });
    }
    socket.on("message:new", onNewMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("typing", onTyping);
    };
  }, [room?.id, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  function handleTyping(value) {
    setText(value);
    if (!room) return;
    socket.emit("typing", { roomId: room.id, userId: currentUser.id, username: currentUser.username, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { roomId: room.id, userId: currentUser.id, username: currentUser.username, isTyping: false });
    }, 1200);
  }

  function sendMessage(file) {
    if (!room) return;
    if (!text.trim() && !file) return;
    socket.emit("message:send", {
      roomId: room.id,
      userId: currentUser.id,
      body: text.trim() || null,
      file: file || undefined,
    });
    setText("");
    socket.emit("typing", { roomId: room.id, userId: currentUser.id, username: currentUser.username, isTyping: false });
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      sendMessage(result);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (!room) {
    return (
      <div className="flex-1 h-full glass-strong rounded-3xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
            💬
          </div>
          <p className="text-white/40">Select a room or contact to start chatting</p>
        </div>
      </div>
    );
  }

  const typingNames = Object.values(typingUsers);

  return (
    <div className="flex-1 h-full glass-strong rounded-3xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold">
          {room.is_dm ? initials(room.displayName) : "#"}
        </div>
        <div>
          <p className="text-white font-medium">{room.displayName}</p>
          <p className="text-xs text-white/35 h-4">
            {typingNames.length > 0 ? `${typingNames.join(", ")} typing…` : ""}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.map((m, i) => {
          const mine = m.user_id === currentUser.id;
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.user_id !== m.user_id;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} animate-floatIn`}>
              {!mine && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-black shrink-0"
                  style={{ background: m.avatar_color, visibility: showAvatar ? "visible" : "hidden" }}
                >
                  {initials(m.username)}
                </div>
              )}
              <div className={`max-w-[65%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && showAvatar && (
                  <span className="text-[11px] text-white/35 mb-1 ml-1">{m.username}</span>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-lg ${
                    mine
                      ? "bg-gradient-to-br from-white to-zinc-200 text-black rounded-br-md"
                      : "glass text-white/90 rounded-bl-md"
                  }`}
                >
                  {m.file_url && (
                    m.file_type?.startsWith("image/") ? (
                      <img
                        src={`${API_BASE}${m.file_url}`}
                        alt={m.file_name}
                        className="rounded-lg max-w-full max-h-64 mb-1"
                      />
                    ) : (
                      <a
                        href={`${API_BASE}${m.file_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 underline decoration-white/40 mb-1"
                      >
                        📎 {m.file_name}
                      </a>
                    )
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <span className={`block text-[10px] mt-1 ${mine ? "text-black/50" : "text-white/30"}`}>
                    {formatTime(m.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="glass rounded-2xl flex items-end gap-2 px-3 py-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-white/40 hover:text-white/80 p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-40"
            title="Attach file"
          >
            {uploading ? "…" : "📎"}
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />
          <textarea
            rows={1}
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent outline-none text-white placeholder-white/25 resize-none py-2 max-h-32"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!text.trim()}
            className="rounded-xl bg-gradient-to-r from-white to-zinc-300 text-black px-4 py-2 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-95 active:scale-95 transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
