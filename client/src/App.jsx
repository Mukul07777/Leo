import { useEffect, useState, useCallback } from "react";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import { getUsers, getRooms, openDm, getOnline } from "./lib/api.js";
import { getSocket } from "./lib/socket.js";

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("leo_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);

  const refreshRooms = useCallback(() => {
    if (!currentUser) return;
    getRooms(currentUser.id).then(setRooms);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem("leo_user", JSON.stringify(currentUser));
    const socket = getSocket();
    socket.emit("identify", { userId: currentUser.id });

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

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

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
      <ChatWindow currentUser={currentUser} room={activeRoom} />
    </div>
  );
}
