<div align="center">

# Leo

**A private, local-first chat app that never touches the cloud.**

Real-time messaging, groups, end-to-end encryption, and a personal AI companion —
all running from your own laptop, over your own Wi-Fi, with zero accounts and zero servers you don't own.

</div>

---

## Why Leo

Every mainstream chat app trades your privacy for convenience: your messages live on someone else's servers, your data trains someone else's models, and "end-to-end encrypted" still means a company sits in the metadata. Leo takes the opposite bet — **your laptop *is* the server.** Nothing here leaves your local network unless you explicitly send it (like opening a Google Maps link). Even the AI features run on a model on your own machine.

| | Leo | Typical cloud chat apps |
|---|---|---|
| Where your messages live | Your laptop, in a local SQLite file | A company's servers |
| End-to-end encryption | ✅ Browser-side ECDH + AES-GCM for DMs | Varies, cloud-mediated |
| AI features | 100% local via [Ollama](https://ollama.com) — nothing ever leaves your machine | Sent to a cloud AI provider |
| Accounts / sign-up | None — just pick a username | Phone number, email, ID verification |
| Ads / telemetry | None, ever | Often the whole business model |

---

## Features

**Messaging**
- Real-time 1-on-1 chats and groups, unified in one WhatsApp-style chat list
- Replies/quotes, edit, delete, emoji reactions, typing indicators, read receipts, online presence
- Voice notes recorded straight in the browser
- File and image sharing
- Full-text search (on unencrypted rooms — see [Encryption](#encryption) below)

**Privacy & security**
- End-to-end encryption for direct messages (ECDH P-256 + AES-GCM via the Web Crypto API) — private keys never leave your device, and the server only ever stores ciphertext
- No accounts, no phone/email verification, no third-party auth
- Runs entirely on your local network — nothing to configure, no ports to open to the internet

**`@leo` — an on-device assistant, not a chatbot in your chats**
Tag `@leo` in any conversation and the message is intercepted *before* it's ever sent — it never reaches the other person or the server. It's parsed and handled entirely in your browser:
- `@leo remind me in 20 min to call mom` → local reminder with a notification + sound
- `@leo set a timer for 10 minutes`
- `@leo navigate to Central Park` → opens Google Maps
- Anything else → answered by your local AI model

**Leo, your personal companion**
A private, always-available AI friend pinned at the top of your chat list — fully separate from your real conversations. Rename it to whatever you like. It remembers context across days (condensing old conversations into durable long-term memory) and talks like an actual friend, not a customer-support bot. Nothing said here ever touches the server database or any other person.

**Design**
- Dark and light themes, plus a fully customizable accent color
- Glassmorphism UI with a premium, glossy, "mirror" button treatment throughout

---

## Getting started

You'll need [Node.js](https://nodejs.org) 22+ (for the built-in SQLite support) and two terminals.

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev        # → http://localhost:4000

# Terminal 2 — frontend
cd client
npm install
npm run dev         # → http://localhost:5173
```

Open **http://localhost:5173**, pick a username, and you're in.

### Inviting others on your Wi-Fi

There's no "add contact" flow — anyone who opens the app on the same network and picks a username shows up automatically for everyone else.

1. Find your laptop's local IP address: `ipconfig` (Windows) or `ifconfig` / `ip a` (macOS/Linux) → look for the `IPv4 Address`, e.g. `192.168.1.23`.
2. Make sure the other device is on the **same Wi-Fi network**.
3. On that device, open `http://<your-laptop-ip>:5173` in a browser.
4. If Windows Firewall prompts you, allow Node.js on **Private networks**.

The in-app "New Chat" dialog also surfaces this URL directly when there's no one else online yet.

---

## Local AI (optional)

`@leo`, the AI reply/summarize buttons, and the Leo companion all use [Ollama](https://ollama.com) running locally. Without it, those features simply stay hidden — nothing else breaks.

```bash
ollama pull llama3.1:8b
```

The server auto-detects Ollama at `http://localhost:11434`. To use a different model, set an environment variable before starting the server:

```bash
OLLAMA_MODEL=llama3.2:3b npm run dev
```

---

## Encryption

Direct messages are end-to-end encrypted:

- Each device generates an ECDH (P-256) keypair on first login; the private key never leaves `localStorage` on that browser.
- Public keys are exchanged via the server (safe to share).
- Message bodies are encrypted client-side with AES-GCM before they're ever sent — the server and its database only ever see ciphertext.
- Because the server can't read DM content, full-text search only works on unencrypted rooms (groups); searching DMs would require decrypting locally, which isn't implemented yet.

**Not yet encrypted:** group chats (would need per-member key wrapping) and file/voice attachments. Contributions welcome.

---

## Project structure

```
Leo/
├── server/            Express + Socket.io + SQLite backend
│   ├── index.js        REST API + realtime events
│   ├── db.js            Schema (users, rooms, messages, reactions, search index)
│   └── uploads/         Shared files/images/voice notes
└── client/             React + Vite + Tailwind frontend
    └── src/
        ├── components/  UI (chat window, sidebar, companion, modals)
        └── lib/          Encryption, theming, the @leo parser, API/socket clients
```

---

## Resetting data

To wipe all chats, users, and files: stop the server and delete `server/db/chat.sqlite*` and the contents of `server/uploads/`. The companion's memory lives separately in each browser's `localStorage` (key `leo_companion_<userId>`) and won't be affected.

---

<div align="center">

Built with Node.js, Express, Socket.io, SQLite, React, Vite, Tailwind CSS, and Ollama.

</div>
