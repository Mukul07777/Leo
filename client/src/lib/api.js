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

export async function createGroup(userId, name, memberIds) {
  const res = await fetch(`${API_BASE}/api/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, name, memberIds }),
  });
  return res.json();
}

export async function getRoomMembers(roomId) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomId}/members`);
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

export async function getAiAssistantReply(text) {
  const res = await fetch(`${API_BASE}/api/ai/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function getCompanionReply(name, memory, history, message) {
  const res = await fetch(`${API_BASE}/api/ai/companion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, memory, history, message }),
  });
  return res.json();
}

export async function updateCompanionMemory(name, memory, transcript) {
  const res = await fetch(`${API_BASE}/api/ai/companion-memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, memory, transcript }),
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
