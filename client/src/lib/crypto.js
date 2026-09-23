// End-to-end encryption for DMs: ECDH (P-256) key exchange + AES-GCM message encryption.
// Private keys never leave this browser (stored in localStorage per device).

const KEY_STORAGE = "leo_keypair";

async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicKeyB64: bufToB64(publicKeyRaw),
    privateKeyJwk,
  };
}

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function ensureKeyPair() {
  let stored = localStorage.getItem(KEY_STORAGE);
  if (stored) return JSON.parse(stored);
  const kp = await generateKeyPair();
  localStorage.setItem(KEY_STORAGE, JSON.stringify(kp));
  return kp;
}

export function getPublicKey() {
  const stored = localStorage.getItem(KEY_STORAGE);
  return stored ? JSON.parse(stored).publicKeyB64 : null;
}

async function importPrivateKey() {
  const stored = JSON.parse(localStorage.getItem(KEY_STORAGE));
  return crypto.subtle.importKey(
    "jwk",
    stored.privateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}

async function importPeerPublicKey(publicKeyB64) {
  return crypto.subtle.importKey(
    "raw",
    b64ToBuf(publicKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

const sharedKeyCache = new Map();

async function deriveSharedKey(peerPublicKeyB64) {
  if (sharedKeyCache.has(peerPublicKeyB64)) return sharedKeyCache.get(peerPublicKeyB64);
  const privateKey = await importPrivateKey();
  const peerKey = await importPeerPublicKey(peerPublicKeyB64);
  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: peerKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  sharedKeyCache.set(peerPublicKeyB64, sharedKey);
  return sharedKey;
}

export async function encryptMessage(peerPublicKeyB64, plaintext) {
  const key = await deriveSharedKey(peerPublicKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { cipher: bufToB64(ciphertext), iv: bufToB64(iv) };
}

export async function decryptMessage(peerPublicKeyB64, cipherB64, ivB64) {
  try {
    const key = await deriveSharedKey(peerPublicKeyB64);
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBuf(ivB64) },
      key,
      b64ToBuf(cipherB64)
    );
    return new TextDecoder().decode(plaintextBuf);
  } catch {
    return null;
  }
}
