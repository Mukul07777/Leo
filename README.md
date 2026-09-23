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
- Real-time messaging via WebSockets (Socket.io)
- Message history stored locally in SQLite (`server/db/chat.sqlite`)
- File & image sharing (stored in `server/uploads/`)
- Typing indicators and read receipts
- Online/offline presence
- Dark, glassy, futuristic UI

## Notes

- All data stays on your laptop — nothing leaves your network.
- To reset all chats/users, stop the server and delete `server/db/chat.sqlite`.
