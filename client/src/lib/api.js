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

export { API_BASE };
