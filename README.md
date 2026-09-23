# Leo

A private WhatsApp/Telegram-style chat app that runs entirely from your laptop — no cloud, no accounts, just your local network.

## Run it

Open two terminals.

**Terminal 1 — server:**
```
cd server
npm run dev
```
Runs on `http://localhost:4000`.

**Terminal 2 — client:**
```
cd client
npm run dev
```
Runs on `http://localhost:5173`.

Open `http://localhost:5173` in your browser and pick a username.

## Using it from your phone / other devices on the same WiFi

1. Find your laptop's local IP: run `ipconfig` (Windows) and look for `IPv4 Address` (e.g. `192.168.1.23`).
2. Make sure both devices are on the same WiFi network.
3. On the other device, open `http://<your-laptop-ip>:5173` in a browser.
4. If Windows Firewall blocks it, allow Node.js through the firewall when prompted (or allow ports 4000 and 5173 for Private networks).

## What's included

- 1-on-1 DMs and a shared `#general` room
- **End-to-end encryption for DMs** — ECDH (P-256) + AES-GCM, done entirely in the browser with the Web Crypto API. Private keys never leave the device; the server only ever stores ciphertext for DM messages.
- Real-time messaging via WebSockets (Socket.io)
- Message replies/quotes, edit, and delete
- Emoji reactions
- Voice notes (record and send audio clips)
- Full-text search (group room only — DMs are encrypted server-side so search happens only in your browser)
- **Local AI assistant** (optional, via [Ollama](https://ollama.com)) — quick reply suggestions and chat summaries, generated entirely on your machine. If Ollama isn't running, these features just hide themselves; nothing breaks.
- File & image sharing (stored in `server/uploads/`)
- Typing indicators and read receipts
- Online/offline presence
- Dark, glassy, black & white futuristic UI

## Local AI (optional)

To enable the ✨ AI reply suggestions and summaries, install [Ollama](https://ollama.com) and pull a model:
```
ollama pull llama3.1:8b
```
The server auto-detects Ollama at `http://localhost:11434`. No model installed → those buttons simply don't appear.

## Notes

- All data stays on your laptop — nothing leaves your network. AI features run 100% locally too.
- DM messages are end-to-end encrypted; even direct database access only reveals ciphertext.
- To reset all chats/users, stop the server and delete `server/db/chat.sqlite`.
