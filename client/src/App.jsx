import { useEffect, useState, useCallback, useRef } from "react";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import ReminderWidget from "./components/ReminderWidget.jsx";
import { getUsers, getRooms, openDm, getOnline, registerPublicKey, getAiAssistantReply } from "./lib/api.js";
import { getSocket } from "./lib/socket.js";
import { ensureKeyPair } from "./lib/crypto.js";
import { parseLeoCommand, unitToMs } from "./lib/assistant.js";
import { requestNotifyPermission, fireNotification } from "./lib/notify.js";

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("leo_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [reminders, setReminders] = useState([]);
  const timeoutsRef = useRef({});

  const refreshRooms = useCallback(() => {
    if (!currentUser) return;
    getRooms(currentUser.id).then(setRooms);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem("leo_user", JSON.stringify(currentUser));
    const socket = getSocket();
    socket.emit("identify", { userId: currentUser.id });

    ensureKeyPair().then((kp) => registerPublicKey(currentUser.id, kp.publicKeyB64));

    getUsers().then(setUsers);
    getOnline().then(setOnlineIds);
    refreshRooms();

    function onPresence({ userId, online }) {
      setOnlineIds((prev) => (online ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)));
    }
    function onNewMessage() {
      refreshRooms();
    }
    socket.on("presence", onPresence);
    socket.on("message:new", onNewMessage);

    const interval = setInterval(() => getUsers().then(setUsers), 8000);

    return () => {
      socket.off("presence", onPresence);
      socket.off("message:new", onNewMessage);
      clearInterval(interval);
    };
  }, [currentUser, refreshRooms]);

  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  function dismissReminder(id) {
    clearTimeout(timeoutsRef.current[id]);
    delete timeoutsRef.current[id];
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  function scheduleReminder(label, ms) {
    requestNotifyPermission();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fireAt = Date.now() + ms;
    setReminders((prev) => [...prev, { id, label, fireAt, fired: false, dismissed: false }]);
    timeoutsRef.current[id] = setTimeout(() => {
      fireNotification("Leo", label);
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, fired: true } : r)));
      setTimeout(() => dismissReminder(id), 15000);
    }, ms);
  }

  // Runs an "@leo ..." command entirely on this device. Never touches the server
  // or the other chat participant — used by ChatWindow to intercept tagged messages.
  async function runLeoCommand(rawText) {
    const cmd = parseLeoCommand(rawText);

    if (cmd.type === "empty") {
      return "What can I help with? Try \"@leo remind me in 5 min to call mom\", \"@leo set a 10 min timer\", or \"@leo navigate to Central Park\".";
    }

    if (cmd.type === "timer" || cmd.type === "reminder") {
      const ms = unitToMs(cmd.amount, cmd.unit);
      const label = cmd.type === "reminder" ? cmd.label : `Timer (${cmd.amount} ${cmd.unit})`;
      scheduleReminder(label, ms);
      return `⏰ Got it — I'll remind you "${label}" in ${cmd.amount} ${cmd.unit}. Keep this tab open so I can alert you.`;
    }

    if (cmd.type === "directions" || cmd.type === "search-map") {
      const url =
        cmd.type === "directions"
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cmd.place)}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cmd.place)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return `🗺️ Opening ${cmd.type === "directions" ? "directions to" : "map for"} "${cmd.place}" in Google Maps.`;
    }

    try {
      const { reply } = await getAiAssistantReply(cmd.text);
      return reply || "I couldn't reach the local AI model (Ollama) for that.";
    } catch {
      return "I can handle reminders, timers, and Google Maps locally. For open-ended questions, make sure Ollama is running.";
    }
  }

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const activeRoomUser = activeRoom?.is_dm ? users.find((u) => u.id === activeRoom.otherUserId) : null;

  async function handleSelectUser(user) {
    const { roomId } = await openDm(currentUser.id, user.id);
    await refreshRooms();
    setActiveRoomId(roomId);
  }

  function handleLogout() {
    localStorage.removeItem("leo_user");
    setCurrentUser(null);
    setActiveRoomId(null);
  }

  return (
    <div className="h-full w-full p-4 flex gap-4">
      <div className="absolute inset-0 overflow-hidden -z-10 grid-overlay">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-96 h-96 rounded-full bg-white/6 blur-3xl" />
      </div>
      <Sidebar
        currentUser={currentUser}
        rooms={rooms}
        users={users}
        onlineIds={onlineIds}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
        onSelectUser={handleSelectUser}
        onLogout={handleLogout}
      />
      <ChatWindow currentUser={currentUser} room={activeRoom} peerUser={activeRoomUser} onLeoCommand={runLeoCommand} />
      <ReminderWidget reminders={reminders} onDismiss={dismissReminder} />
    </div>
  );
}
