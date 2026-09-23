// Personal AI companion — fully local. Conversation and memory live only in this
// browser's localStorage; nothing is ever sent to the app's server/database or any
// other person. Only the (already-local) Ollama model on this machine sees the text,
// exactly like the @leo assistant.

import { getCompanionReply, updateCompanionMemory } from "./api.js";

export const DEFAULT_NAME = "Leo";
const SIX_HOURS = 6 * 60 * 60 * 1000;
const CONSOLIDATE_THRESHOLD = 14;

function storageKey(userId) {
  return `leo_companion_${userId}`;
}

export function loadCompanion(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    name: DEFAULT_NAME,
    messages: [],
    memory: "",
    lastMemoryUpdateIndex: 0,
    lastInteractionAt: 0,
  };
}

export function saveCompanion(userId, state) {
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function renameCompanion(userId, newName) {
  const state = loadCompanion(userId);
  state.name = (newName || DEFAULT_NAME).trim().slice(0, 24) || DEFAULT_NAME;
  saveCompanion(userId, state);
  return state;
}

// Sends a message to the companion, appends both sides to local history, and
// opportunistically folds older turns into long-term memory in the background.
export async function sendToCompanion(userId, text) {
  const state = loadCompanion(userId);
  const prevInteractionAt = state.lastInteractionAt;
  const now = Date.now();

  const userMsg = { id: `u-${now}`, role: "user", text, ts: now };
  state.messages.push(userMsg);

  const { reply } = await getCompanionReply(state.name, state.memory, state.messages.slice(0, -1), text);
  const replyText = reply || "Hmm, I'm having trouble thinking right now — make sure Ollama is running.";

  const companionMsg = { id: `c-${now}`, role: "companion", text: replyText, ts: Date.now() };
  state.messages.push(companionMsg);
  state.lastInteractionAt = Date.now();
  saveCompanion(userId, state);

  const pending = state.messages.length - state.lastMemoryUpdateIndex;
  const cameBackAfterBreak = prevInteractionAt && now - prevInteractionAt > SIX_HOURS;
  if (pending >= CONSOLIDATE_THRESHOLD || (cameBackAfterBreak && pending >= 2)) {
    consolidateMemory(userId).catch(() => {});
  }

  return companionMsg;
}

export async function consolidateMemory(userId) {
  const state = loadCompanion(userId);
  const slice = state.messages.slice(state.lastMemoryUpdateIndex);
  if (slice.length === 0) return;
  const transcript = slice.map((m) => `${m.role === "user" ? "Them" : state.name}: ${m.text}`).join("\n");
  const { memory } = await updateCompanionMemory(state.name, state.memory, transcript);
  const fresh = loadCompanion(userId);
  fresh.memory = memory || fresh.memory;
  fresh.lastMemoryUpdateIndex = state.messages.length;
  saveCompanion(userId, fresh);
  return fresh;
}
