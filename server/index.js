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

const app = express();
app.use(cors());
app.use(express.json());
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

function getOrCreateGeneralRoom() {
  let room = db.prepare("SELECT * FROM rooms WHERE is_dm = 0 AND name = 'general'").get();
  if (!room) {
    const id = nanoid(10);
    db.prepare("INSERT INTO rooms (id, name, is_dm, created_at) VALUES (?,?,0,?)").run(id, "general", Date.now());
    room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
  }
  return room;
}
getOrCreateGeneralRoom();

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
  const general = getOrCreateGeneralRoom();
  db.prepare("INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?,?)").run(general.id, user.id);

  res.json({ user });
});

app.get("/api/users", (_req, res) => {
  res.json(db.prepare("SELECT id, username, avatar_color, last_seen FROM users").all());
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
    if (r.is_dm) {
      const other = db.prepare(`
        SELECT u.username FROM room_members rm
        JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = ? AND rm.user_id != ?
      `).get(r.id, req.params.userId);
      displayName = other ? other.username : r.name;
    }
    const lastMsg = db.prepare("SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 1").get(r.id);
    return { ...r, displayName, lastMsg };
  });
  res.json(withMeta);
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
  db.prepare("INSERT INTO rooms (id, name, is_dm, created_at) VALUES (?,?,1,?)").run(id, "dm", Date.now());
  db.prepare("INSERT INTO room_members (room_id, user_id) VALUES (?,?)").run(id, userId);
  db.prepare("INSERT INTO room_members (room_id, user_id) VALUES (?,?)").run(id, otherUserId);
  res.json({ roomId: id });
});

app.get("/api/messages/:roomId", (req, res) => {
  const msgs = db.prepare(`
    SELECT m.*, u.username, u.avatar_color FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.room_id = ? ORDER BY m.created_at ASC LIMIT 200
  `).all(req.params.roomId);
  res.json(msgs);
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  res.json({
    url: `/uploads/${req.file.filename}`,
    name: req.file.originalname,
    type: req.file.mimetype,
  });
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

  socket.on("message:send", ({ roomId, userId, body, file }) => {
    const id = nanoid(14);
    const created_at = Date.now();
    db.prepare(`
      INSERT INTO messages (id, room_id, user_id, body, file_url, file_name, file_type, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(id, roomId, userId, body || null, file?.url || null, file?.name || null, file?.type || null, created_at);

    const user = db.prepare("SELECT username, avatar_color FROM users WHERE id = ?").get(userId);
    const message = { id, room_id: roomId, user_id: userId, body, file_url: file?.url, file_name: file?.name, file_type: file?.type, created_at, username: user.username, avatar_color: user.avatar_color };
    io.to(roomId).emit("message:new", message);
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
