import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const database = new DatabaseSync(path.join(__dirname, "db", "chat.sqlite"));

database.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_color TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_dm INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reads (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_message_id TEXT,
  PRIMARY KEY (room_id, user_id)
);
`);

// Thin wrapper to keep the better-sqlite3-style call pattern used elsewhere:
// db.prepare(sql).run(...args) / .get(...args) / .all(...args)
const db = {
  prepare(sql) {
    const stmt = database.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  },
  exec(sql) {
    return database.exec(sql);
  },
};

export default db;
