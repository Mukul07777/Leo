import { useEffect, useState } from "react";

function formatRemaining(ms) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ReminderWidget({ reminders, onDismiss }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (reminders.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [reminders.length]);

  const visible = reminders.filter((r) => !r.dismissed);
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-72">
      {visible.map((r) => {
        const remaining = r.fireAt - Date.now();
        const done = remaining <= 0 || r.fired;
        return (
          <div
            key={r.id}
            className={`glass-strong rounded-2xl px-4 py-3 mono-glow animate-floatIn flex items-center gap-3 ${done ? "border-white/30" : ""}`}
          >
            <span className="text-xl">{done ? "✅" : "⏰"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 truncate">{r.label}</p>
              <p className="text-xs text-white/40">{done ? "Leo · reminder fired" : `Leo · in ${formatRemaining(remaining)}`}</p>
            </div>
            <button onClick={() => onDismiss(r.id)} className="text-white/30 hover:text-white/70 text-sm px-1">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
