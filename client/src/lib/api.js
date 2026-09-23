const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

export async function login(username) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return res.json();
}

export async function getUsers() {
  const res = await fetch(`${API_BASE}/api/users`);
  return res.json();
}

export async function getRooms(userId) {
  const res = await fetch(`${API_BASE}/api/rooms/${userId}`);
  return res.json();
}

export async function openDm(userId, otherUserId) {
  const res = await fetch(`${API_BASE}/api/dm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, otherUserId }),
  });
  return res.json();
}

export async function getMessages(roomId) {
  const res = await fetch(`${API_BASE}/api/messages/${roomId}`);
  return res.json();
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
  return res.json();
}

export async function getOnline() {
  const res = await fetch(`${API_BASE}/api/online`);
  return res.json();
}

export async function registerPublicKey(userId, publicKey) {
  const res = await fetch(`${API_BASE}/api/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, publicKey }),
  });
  return res.json();
}

export async function getPublicKeyFor(userId) {
  const res = await fetch(`${API_BASE}/api/keys/${userId}`);
  return res.json();
}

export async function searchMessages(roomId, query) {
  const res = await fetch(`${API_BASE}/api/search/${roomId}?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function getAiStatus() {
  const res = await fetch(`${API_BASE}/api/ai/status`);
  return res.json();
}

export async function getAiReplies(history) {
  const res = await fetch(`${API_BASE}/api/ai/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  return res.json();
}

export async function getAiSummary(history) {
  const res = await fetch(`${API_BASE}/api/ai/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
  return res.json();
}

export { API_BASE };
