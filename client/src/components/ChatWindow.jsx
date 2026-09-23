import { useEffect, useRef, useState, useMemo } from "react";
import {
  getMessages, uploadFile, API_BASE, searchMessages,
  getAiStatus, getAiReplies, getAiSummary,
} from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { encryptMessage, decryptMessage } from "../lib/crypto.js";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(sec) {
  const s = Math.round(sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ChatWindow({ currentUser, room, peerUser }) {
  const [messages, setMessages] = useState([]);
  const [decrypted, setDecrypted] = useState({}); // messageId -> plaintext
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [uploading, setUploading] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [openPickerFor, setOpenPickerFor] = useState(null);
  const [openMenuFor, setOpenMenuFor] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const socket = getSocket();

  const isEncrypted = !!room?.encrypted;
  const peerKey = peerUser?.public_key || null;
  const canEncrypt = !isEncrypted || !!peerKey;

  useEffect(() => {
    getAiStatus().then((s) => setAiAvailable(!!s.available));
  }, []);

  useEffect(() => {
    if (!room) return;
    let active = true;
    getMessages(room.id).then((msgs) => {
      if (active) setMessages(msgs);
    });
    socket.emit("join", room.id);
    setTypingUsers({});
    setReplyTarget(null);
    setEditingId(null);
    setSearchOpen(false);
    setSummary(null);
    setAiSuggestions([]);

    return () => {
      socket.emit("leave", room.id);
      active = false;
    };
  }, [room?.id]);

  // Decrypt any messages (and reply previews) that need it
  useEffect(() => {
    if (!isEncrypted || !peerKey) return;
    const toDecrypt = [];
    for (const m of messages) {
      if (m.cipher && m.iv && !(m.id in decrypted)) toDecrypt.push(m);
      if (m.reply_preview?.cipher && m.reply_preview?.iv && !(`reply:${m.reply_preview.id}` in decrypted)) {
        toDecrypt.push({ id: `reply:${m.reply_preview.id}`, cipher: m.reply_preview.cipher, iv: m.reply_preview.iv });
      }
    }
    if (toDecrypt.length === 0) return;
    (async () => {
      const updates = {};
      for (const m of toDecrypt) {
        updates[m.id] = (await decryptMessage(peerKey, m.cipher, m.iv)) ?? "[unable to decrypt]";
      }
      setDecrypted((prev) => ({ ...prev, ...updates }));
    })();
  }, [messages, isEncrypted, peerKey]);

  useEffect(() => {
    function onNewMessage(msg) {
      if (msg.room_id !== room?.id) return;
      setMessages((prev) => [...prev, msg]);
      if (msg.user_id !== currentUser.id) {
        socket.emit("read", { roomId: room.id, userId: currentUser.id, messageId: msg.id });
      }
    }
    function onEdited({ id, body, cipher, iv, edited_at }) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body, cipher, iv, edited_at } : m)));
      setDecrypted((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    function onDeleted({ id }) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted: 1, body: null, cipher: null, file_url: null } : m)));
    }
    function onReaction({ messageId, reactions }) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
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
    socket.on("message:edited", onEdited);
    socket.on("message:deleted", onDeleted);
    socket.on("reaction:update", onReaction);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("message:edited", onEdited);
      socket.off("message:deleted", onDeleted);
      socket.off("reaction:update", onReaction);
      socket.off("typing", onTyping);
    };
  }, [room?.id, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers]);

  function bodyOf(m) {
    if (m.deleted) return null;
    if (m.cipher) return decrypted[m.id] ?? "…";
    return m.body;
  }

  function handleTyping(value) {
    setText(value);
    if (!room) return;
    socket.emit("typing", { roomId: room.id, userId: currentUser.id, username: currentUser.username, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { roomId: room.id, userId: currentUser.id, username: currentUser.username, isTyping: false });
    }, 1200);
  }

  async function sendMessage(file) {
    if (!room) return;
    const plain = text.trim();
    if (!plain && !file) return;
    if (!canEncrypt) return;

    let payload = { body: plain || null };
    if (isEncrypted && peerKey && plain) {
      const { cipher, iv } = await encryptMessage(peerKey, plain);
      payload = { body: null, cipher, iv };
    }

    if (editingId) {
      socket.emit("message:edit", { roomId: room.id, messageId: editingId, userId: currentUser.id, ...payload });
      setEditingId(null);
      setText("");
      return;
    }

    socket.emit("message:send", {
      roomId: room.id,
      userId: currentUser.id,
      ...payload,
      file: file || undefined,
      replyToId: replyTarget?.id || undefined,
    });
    setText("");
    setReplyTarget(null);
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

  function startEdit(m) {
    setEditingId(m.id);
    setReplyTarget(null);
    setText(bodyOf(m) || "");
    setOpenMenuFor(null);
  }

  function deleteMessage(m) {
    socket.emit("message:delete", { roomId: room.id, messageId: m.id, userId: currentUser.id });
    setOpenMenuFor(null);
  }

  function toggleReaction(messageId, emoji) {
    socket.emit("reaction:toggle", { roomId: room.id, messageId, userId: currentUser.id, emoji });
    setOpenPickerFor(null);
  }

  async function runSearch(q) {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await searchMessages(room.id, q.trim());
    setSearchResults(results);
  }

  async function requestAiReplies() {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const history = messages.slice(-12).map((m) => ({ username: m.username, body: bodyOf(m) || "" }));
      const { suggestions } = await getAiReplies(history);
      setAiSuggestions(suggestions || []);
    } finally {
      setAiLoading(false);
    }
  }

  async function requestSummary() {
    setSummaryLoading(true);
    setSummary(null);
    try {
      const history = messages.slice(-60).map((m) => ({ username: m.username, body: bodyOf(m) || "" }));
      const { summary: s } = await getAiSummary(history);
      setSummary(s || "No summary available.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && recordChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
        const duration = recordSeconds;
        setRecording(false);
        setRecordSeconds(0);
        clearInterval(recordTimerRef.current);
        if (blob.size > 500) {
          setUploading(true);
          try {
            const form = new FormData();
            form.append("file", new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }));
            const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
            const result = await res.json();
            sendMessage({ ...result, duration });
          } finally {
            setUploading(false);
          }
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-medium truncate">{room.displayName}</p>
            {isEncrypted && (
              <span title={canEncrypt ? "End-to-end encrypted" : "Waiting for encryption keys…"} className="text-[11px] text-white/40">
                {canEncrypt ? "🔒" : "🔓"}
              </span>
            )}
          </div>
          <p className="text-xs text-white/35 h-4 truncate">
            {typingNames.length > 0 ? `${typingNames.join(", ")} typing…` : ""}
          </p>
        </div>
        {aiAvailable && (
          <button
            onClick={requestSummary}
            className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors border border-white/10"
            title="AI summary of this chat (runs locally via Ollama)"
          >
            ✨ Summarize
          </button>
        )}
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className={`text-white/40 hover:text-white/80 p-2 rounded-xl hover:bg-white/5 transition-colors ${searchOpen ? "bg-white/10 text-white" : ""}`}
          title="Search messages"
        >
          🔍
        </button>
      </div>

      {searchOpen && (
        <div className="px-6 py-3 border-b border-white/5 glass">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => runSearch(e.target.value)}
            placeholder={isEncrypted ? "Search unavailable for encrypted chats" : "Search messages…"}
            disabled={isEncrypted}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/30 disabled:opacity-40"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {searchResults.map((r) => (
                <div key={r.id} className="text-xs text-white/60 px-2 py-1.5 rounded-lg bg-white/5">
                  <span className="text-white/80 font-medium">{r.username}: </span>
                  {r.body}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {summary !== null && (
        <div className="mx-6 mt-3 p-4 rounded-2xl glass border border-white/10 relative animate-floatIn">
          <button onClick={() => setSummary(null)} className="absolute top-2 right-3 text-white/30 hover:text-white/70">✕</button>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">✨ AI Summary (local)</p>
          <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{summaryLoading ? "Thinking…" : summary}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {messages.map((m, i) => {
          const mine = m.user_id === currentUser.id;
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.user_id !== m.user_id;
          const body = bodyOf(m);
          const reactionGroups = {};
          for (const r of m.reactions || []) {
            (reactionGroups[r.emoji] ||= []).push(r.user_id);
          }

          return (
            <div
              key={m.id}
              className={`group flex items-end gap-2 py-1 ${mine ? "justify-end" : "justify-start"} animate-floatIn`}
            >
              {!mine && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-black shrink-0"
                  style={{ background: m.avatar_color, visibility: showAvatar ? "visible" : "hidden" }}
                >
                  {initials(m.username)}
                </div>
              )}

              <div className={`max-w-[65%] ${mine ? "items-end" : "items-start"} flex flex-col relative`}>
                {!mine && showAvatar && (
                  <span className="text-[11px] text-white/35 mb-1 ml-1">{m.username}</span>
                )}

                <div className={`flex items-center gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-lg relative ${
                      mine
                        ? "bg-gradient-to-br from-white to-zinc-200 text-black rounded-br-md"
                        : "glass text-white/90 rounded-bl-md"
                    } ${m.deleted ? "opacity-50 italic" : ""}`}
                  >
                    {m.reply_preview && !m.deleted && (
                      <div className={`text-xs mb-1.5 pl-2 border-l-2 ${mine ? "border-black/20 text-black/60" : "border-white/20 text-white/50"}`}>
                        <span className="font-medium">{m.reply_preview.username}</span>{" "}
                        {m.reply_preview.deleted
                          ? "message deleted"
                          : m.reply_preview.cipher
                          ? (decrypted[`reply:${m.reply_preview.id}`] ?? "…")
                          : (m.reply_preview.body || (m.reply_preview.file_name && `📎 ${m.reply_preview.file_name}`))}
                      </div>
                    )}

                    {m.deleted ? (
                      <p>message deleted</p>
                    ) : (
                      <>
                        {m.file_url && (
                          m.voice_duration != null ? (
                            <audio controls src={`${API_BASE}${m.file_url}`} className="max-w-[220px] h-9" />
                          ) : m.file_type?.startsWith("image/") ? (
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
                              className="flex items-center gap-2 underline decoration-current/40 mb-1"
                            >
                              📎 {m.file_name}
                            </a>
                          )
                        )}
                        {body && <p className="whitespace-pre-wrap break-words">{body}</p>}
                        <span className={`block text-[10px] mt-1 ${mine ? "text-black/50" : "text-white/30"}`}>
                          {formatTime(m.created_at)}{m.edited_at ? " · edited" : ""}
                        </span>
                      </>
                    )}
                  </div>

                  {!m.deleted && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-xs relative">
                      <button
                        onClick={() => setOpenPickerFor(openPickerFor === m.id ? null : m.id)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                        title="React"
                      >
                        😊
                      </button>
                      <button
                        onClick={() => { setReplyTarget(m); setEditingId(null); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                        title="Reply"
                      >
                        ↩
                      </button>
                      {mine && (
                        <button
                          onClick={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                          title="More"
                        >
                          ⋯
                        </button>
                      )}

                      {openPickerFor === m.id && (
                        <div className={`absolute z-10 top-8 ${mine ? "right-0" : "left-0"} glass-strong rounded-xl px-2 py-1.5 flex gap-1 shadow-glow`}>
                          {QUICK_EMOJIS.map((e) => (
                            <button key={e} onClick={() => toggleReaction(m.id, e)} className="hover:scale-125 transition-transform text-base">
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                      {openMenuFor === m.id && (
                        <div className={`absolute z-10 top-8 ${mine ? "right-0" : "left-0"} glass-strong rounded-xl py-1 shadow-glow min-w-24 text-left`}>
                          {(m.body || m.cipher) && !m.file_url && (
                            <button onClick={() => startEdit(m)} className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">Edit</button>
                          )}
                          <button onClick={() => deleteMessage(m)} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-white/10">Delete</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {Object.keys(reactionGroups).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                    {Object.entries(reactionGroups).map(([emoji, uids]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(m.id, emoji)}
                        className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                          uids.includes(currentUser.id) ? "bg-white/20 border-white/30" : "bg-white/5 border-white/10"
                        }`}
                      >
                        {emoji} {uids.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {aiSuggestions.length > 0 && (
        <div className="px-6 pb-2 flex gap-2 flex-wrap">
          {aiSuggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setText(s); setAiSuggestions([]); }}
              className="text-xs px-3 py-1.5 rounded-full glass border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {(replyTarget || editingId) && (
        <div className="px-6 pt-2 flex items-center gap-2">
          <div className="flex-1 glass rounded-xl px-3 py-2 flex items-center justify-between border-l-2 border-white/30">
            <div className="text-xs text-white/60 truncate">
              {editingId ? "Editing message" : (
                <>Replying to <span className="text-white/90 font-medium">{replyTarget.username}</span>: {bodyOf(replyTarget) || replyTarget.file_name}</>
              )}
            </div>
            <button
              onClick={() => { setReplyTarget(null); setEditingId(null); setText(""); }}
              className="text-white/40 hover:text-white/80 ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-white/5">
        {!canEncrypt && (
          <p className="text-xs text-amber-400/80 mb-2 px-1">
            Waiting for {room.displayName} to come online at least once to set up encryption before you can message them.
          </p>
        )}
        <div className="glass rounded-2xl flex items-end gap-2 px-3 py-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !canEncrypt}
            className="text-white/40 hover:text-white/80 p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-40"
            title="Attach file"
          >
            {uploading ? "…" : "📎"}
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />

          {recording ? (
            <div className="flex-1 flex items-center gap-2 py-2 text-sm text-white/70">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulseDot" />
              Recording… {formatDuration(recordSeconds)}
            </div>
          ) : (
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
              placeholder={canEncrypt ? "Type a message…" : "Encryption not ready…"}
              disabled={!canEncrypt}
              className="flex-1 bg-transparent outline-none text-white placeholder-white/25 resize-none py-2 max-h-32 disabled:opacity-40"
            />
          )}

          {aiAvailable && !recording && (
            <button
              onClick={requestAiReplies}
              disabled={aiLoading}
              className="text-white/40 hover:text-white/80 p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-40"
              title="AI reply suggestions (local)"
            >
              {aiLoading ? "…" : "✨"}
            </button>
          )}

          <button
            onClick={recording ? stopRecording : (text.trim() ? () => sendMessage() : startRecording)}
            disabled={!canEncrypt}
            className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all ${
              recording ? "bg-red-500 text-white hover:brightness-95 active:scale-95" : "btn-mirror"
            }`}
          >
            {recording ? "Stop" : text.trim() ? "Send" : "🎙"}
          </button>
        </div>
      </div>
    </div>
  );
}
