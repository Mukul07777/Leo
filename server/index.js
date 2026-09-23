import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import { nanoid } from "nanoid";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid(12)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const AVATAR_COLORS = ["#e4e4e7", "#a1a1aa", "#71717a", "#d4d4d8", "#f4f4f5", "#52525b", "#c9c9cf", "#8b8b93"];

function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function attachReactions(messages) {
  if (messages.length === 0) return messages;
  const ids = messages.map((m) => m.id);
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM reactions WHERE message_id IN (${placeholders})`).all(...ids);
  const byMsg = {};
  for (const r of rows) {
    (byMsg[r.message_id] ||= []).push({ user_id: r.user_id, emoji: r.emoji });
  }
  return messages.map((m) => ({ ...m, reactions: byMsg[m.id] || [] }));
}

function attachReplyPreview(messages) {
  return messages.map((m) => {
    if (!m.reply_to_id) return m;
    const reply = db.prepare(`
      SELECT m.id, m.body, m.cipher, m.iv, m.deleted, m.file_name, u.username FROM messages m
      JOIN users u ON u.id = m.user_id WHERE m.id = ?
    `).get(m.reply_to_id);
    return { ...m, reply_preview: reply || null };
  });
}

// ---------- REST API ----------

app.post("/api/login", (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: "username required" });
  const uname = username.trim().slice(0, 24);

  let user = db.prepare("SELECT * FROM users WHERE username = ?").get(uname);
  if (!user) {
    const id = nanoid(10);
    db.prepare("INSERT INTO users (id, username, avatar_color, created_at) VALUES (?,?,?,?)").run(
      id, uname, pickColor(), Date.now()
    );
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  res.json({ user });
});

app.post("/api/keys", (req, res) => {
  const { userId, publicKey } = req.body;
  if (!userId || !publicKey) return res.status(400).json({ error: "userId and publicKey required" });
  db.prepare("UPDATE users SET public_key = ? WHERE id = ?").run(publicKey, userId);
  res.json({ ok: true });
});

app.get("/api/keys/:userId", (req, res) => {
  const row = db.prepare("SELECT public_key FROM users WHERE id = ?").get(req.params.userId);
  res.json({ publicKey: row?.public_key || null });
});

app.get("/api/users", (_req, res) => {
  res.json(db.prepare("SELECT id, username, avatar_color, last_seen, public_key FROM users").all());
});

app.get("/api/rooms/:userId", (req, res) => {
  const rooms = db.prepare(`
    SELECT r.* FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ?
    ORDER BY r.is_dm ASC, r.created_at ASC
  `).all(req.params.userId);

  const withMeta = rooms.map((r) => {
    let displayName = r.name;
    let otherUserId = null;
    let memberCount = null;
    if (r.is_dm) {
      const other = db.prepare(`
        SELECT u.id, u.username FROM room_members rm
        JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = ? AND rm.user_id != ?
      `).get(r.id, req.params.userId);
      displayName = other ? other.username : r.name;
      otherUserId = other ? other.id : null;
    } else {
      memberCount = db.prepare("SELECT COUNT(*) AS c FROM room_members WHERE room_id = ?").get(r.id).c;
    }
    const lastMsg = db.prepare("SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 1").get(r.id);
    return { ...r, displayName, otherUserId, memberCount, lastMsg };
  });
  res.json(withMeta);
});

app.post("/api/groups", (req, res) => {
  const { userId, name, memberIds } = req.body;
  const uname = (name || "").trim().slice(0, 40);
  if (!uname) return res.status(400).json({ error: "group name required" });
  const members = [...new Set([userId, ...(memberIds || [])])].filter(Boolean);
  if (members.length < 2) return res.status(400).json({ error: "pick at least one other member" });

  const id = nanoid(10);
  db.prepare("INSERT INTO rooms (id, name, is_dm, encrypted, created_at) VALUES (?,?,0,0,?)").run(id, uname, Date.now());
  const insertMember = db.prepare("INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?,?)");
  for (const uid of members) insertMember.run(id, uid);

  res.json({ roomId: id });
});

app.get("/api/rooms/:roomId/members", (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar_color FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `).all(req.params.roomId);
  res.json(members);
});

app.post("/api/dm", (req, res) => {
  const { userId, otherUserId } = req.body;
  if (userId === otherUserId) return res.status(400).json({ error: "cannot dm self" });

  const existing = db.prepare(`
    SELECT r.id FROM rooms r
    JOIN room_members m1 ON m1.room_id = r.id AND m1.user_id = ?
    JOIN room_members m2 ON m2.room_id = r.id AND m2.user_id = ?
    WHERE r.is_dm = 1
  `).get(userId, otherUserId);

  if (existing) return res.json({ roomId: existing.id });

  const id = nanoid(10);
  db.prepare("INSERT INTO rooms (id, name, is_dm, encrypted, created_at) VALUES (?,?,1,1,?)").run(id, "dm", Date.now());
  db.prepare("INSERT INTO room_members (room_id, user_id) VALUES (?,?)").run(id, userId);
  db.prepare("INSERT INTO room_members (room_id, user_id) VALUES (?,?)").run(id, otherUserId);
  res.json({ roomId: id });
});

app.get("/api/messages/:roomId", (req, res) => {
  let msgs = db.prepare(`
    SELECT m.*, u.username, u.avatar_color FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.room_id = ? ORDER BY m.created_at ASC LIMIT 300
  `).all(req.params.roomId);
  msgs = attachReactions(msgs);
  msgs = attachReplyPreview(msgs);
  res.json(msgs);
});

app.get("/api/search/:roomId", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const rows = db.prepare(`
    SELECT m.*, u.username, u.avatar_color FROM messages_fts f
    JOIN messages m ON m.rowid = f.rowid
    JOIN users u ON u.id = m.user_id
    WHERE f.body MATCH ? AND m.room_id = ? AND m.deleted = 0
    ORDER BY m.created_at DESC LIMIT 50
  `).all(`${q}*`, req.params.roomId);
  res.json(rows);
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  res.json({
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    type: req.file.mimetype,
  });
});

app.get("/api/ai/status", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) throw new Error("bad status");
    res.json({ available: true, model: OLLAMA_MODEL });
  } catch {
    res.json({ available: false });
  }
});

app.post("/api/ai/reply", async (req, res) => {
  const { history } = req.body; // array of { username, body }
  try {
    const transcript = (history || []).slice(-12).map((m) => `${m.username}: ${m.body}`).join("\n");
    const prompt = `You are suggesting short reply options for a chat app, based only on the conversation below. Reply with exactly 3 short casual reply suggestions (max 8 words each), one per line, no numbering, no quotes, no extra text.\n\nConversation:\n${transcript}\n\nReplies:`;
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json();
    const suggestions = (data.response || "")
      .split("\n")
      .map((s) => s.replace(/^[-*\d.\s"]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    res.json({ suggestions });
  } catch (err) {
    res.status(503).json({ error: "AI unavailable", suggestions: [] });
  }
});

app.post("/api/ai/assistant", async (req, res) => {
  const { text } = req.body;
  try {
    const prompt = `You are Leo, a concise on-device assistant embedded in a private chat app. Answer the user's request directly and briefly (2-3 sentences max), no preamble like "As an AI".\n\nUser: ${text}\nLeo:`;
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await r.json();
    res.json({ reply: (data.response || "").trim() });
  } catch (err) {
    res.status(503).json({ error: "AI unavailable", reply: "" });
  }
});

app.post("/api/ai/companion", async (req, res) => {
  const { name, memory, history, message } = req.body;
  try {
    const companionName = (name || "Leo").trim().slice(0, 24);
    const recent = (history || []).slice(-20).map((m) => `${m.role === "user" ? "Them" : companionName}: ${m.text}`).join("\n");
    const memoryBlock = memory
      ? `What you remember about this person from earlier conversations:\n${memory}\n\n`
      : "";
    const prompt = `You are ${companionName}, this person's warm, casual, genuinely caring personal friend inside a private chat app. Nobody else can ever read this conversation. Talk like a real close friend texting — short, natural, curious, occasionally ask how they're doing or follow up on things they've mentioned before. Never say you're an AI assistant or mention being a language model. Keep replies brief (1-3 sentences) like a real text message.\n\n${memoryBlock}Recent conversation:\n${recent}\n\nThem: ${message}\n${companionName}:`;
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    res.json({ reply: (data.response || "").trim() });
  } catch (err) {
    res.status(503).json({ error: "AI unavailable", reply: "" });
  }
});

app.post("/api/ai/companion-memory", async (req, res) => {
  const { name, memory, transcript } = req.body;
  try {
    const companionName = (name || "Leo").trim().slice(0, 24);
    const prompt = `You are maintaining ${companionName}'s private long-term memory of a friend, based on their chat history. Update the memory notes below with new durable facts, preferences, ongoing topics, or events worth remembering from the new conversation. Keep it compact (max 10 short bullet points), merge duplicates, drop anything stale or no longer relevant. Output ONLY the updated bullet list, nothing else.\n\nExisting memory:\n${memory || "(none yet)"}\n\nNew conversation:\n${transcript}\n\nUpdated memory:`;
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    res.json({ memory: (data.response || "").trim() });
  } catch (err) {
    res.status(503).json({ error: "AI unavailable", memory: memory || "" });
  }
});

app.post("/api/ai/summarize", async (req, res) => {
  const { history } = req.body;
  try {
    const transcript = (history || []).slice(-60).map((m) => `${m.username}: ${m.body}`).join("\n");
    const prompt = `Summarize this chat conversation in 3-5 concise bullet points, focusing on key topics, decisions, and action items. No preamble.\n\nConversation:\n${transcript}\n\nSummary:`;
    const r = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    res.json({ summary: (data.response || "").trim() });
  } catch (err) {
    res.status(503).json({ error: "AI unavailable", summary: "" });
  }
});

// ---------- Socket.io realtime ----------

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const onlineUsers = new Map(); // userId -> Set(socketId)

io.on("connection", (socket) => {
  let currentUser = null;

  socket.on("identify", ({ userId }) => {
    currentUser = userId;
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    io.emit("presence", { userId, online: true });
  });

  socket.on("join", (roomId) => socket.join(roomId));
  socket.on("leave", (roomId) => socket.leave(roomId));

  socket.on("message:send", ({ roomId, userId, body, cipher, iv, file, replyToId }) => {
    const id = nanoid(14);
    const created_at = Date.now();
    db.prepare(`
      INSERT INTO messages (id, room_id, user_id, body, cipher, iv, file_url, file_name, file_type, voice_duration, reply_to_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, roomId, userId,
      body || null, cipher || null, iv || null,
      file?.url || null, file?.name || null, file?.type || null, file?.duration || null,
      replyToId || null, created_at
    );

    const user = db.prepare("SELECT username, avatar_color FROM users WHERE id = ?").get(userId);
    let message = {
      id, room_id: roomId, user_id: userId, body, cipher, iv,
      file_url: file?.url, file_name: file?.name, file_type: file?.type, voice_duration: file?.duration,
      reply_to_id: replyToId || null, created_at, username: user.username, avatar_color: user.avatar_color,
      reactions: [],
    };
    [message] = attachReplyPreview([message]);
    io.to(roomId).emit("message:new", message);
  });

  socket.on("message:edit", ({ roomId, messageId, userId, body, cipher, iv }) => {
    const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
    if (!msg || msg.user_id !== userId) return;
    const edited_at = Date.now();
    db.prepare("UPDATE messages SET body = ?, cipher = ?, iv = ?, edited_at = ? WHERE id = ?").run(
      body || null, cipher || null, iv || null, edited_at, messageId
    );
    io.to(roomId).emit("message:edited", { id: messageId, body, cipher, iv, edited_at });
  });

  socket.on("message:delete", ({ roomId, messageId, userId }) => {
    const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
    if (!msg || msg.user_id !== userId) return;
    db.prepare("UPDATE messages SET deleted = 1, body = NULL, cipher = NULL, iv = NULL, file_url = NULL WHERE id = ?").run(messageId);
    io.to(roomId).emit("message:deleted", { id: messageId });
  });

  socket.on("reaction:toggle", ({ roomId, messageId, userId, emoji }) => {
    const existing = db.prepare("SELECT * FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?").get(messageId, userId, emoji);
    if (existing) {
      db.prepare("DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?").run(messageId, userId, emoji);
    } else {
      db.prepare("INSERT INTO reactions (message_id, user_id, emoji) VALUES (?,?,?)").run(messageId, userId, emoji);
    }
    const reactions = db.prepare("SELECT user_id, emoji FROM reactions WHERE message_id = ?").all(messageId);
    io.to(roomId).emit("reaction:update", { messageId, reactions });
  });

  socket.on("typing", ({ roomId, userId, username, isTyping }) => {
    socket.to(roomId).emit("typing", { userId, username, isTyping });
  });

  socket.on("read", ({ roomId, userId, messageId }) => {
    db.prepare(`
      INSERT INTO reads (room_id, user_id, last_read_message_id) VALUES (?,?,?)
      ON CONFLICT(room_id, user_id) DO UPDATE SET last_read_message_id = excluded.last_read_message_id
    `).run(roomId, userId, messageId);
    socket.to(roomId).emit("read", { roomId, userId, messageId });
  });

  socket.on("disconnect", () => {
    if (currentUser && onlineUsers.has(currentUser)) {
      onlineUsers.get(currentUser).delete(socket.id);
      if (onlineUsers.get(currentUser).size === 0) {
        onlineUsers.delete(currentUser);
        db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").run(Date.now(), currentUser);
        io.emit("presence", { userId: currentUser, online: false });
      }
    }
  });
});

app.get("/api/online", (_req, res) => {
  res.json([...onlineUsers.keys()]);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
