import { useTheme, ACCENT_PRESETS } from "../lib/theme.jsx";

export default function SettingsPanel({ onClose }) {
  const { mode, accent, setMode, setAccent, resetAccent } = useTheme();

  return (
    <div className="absolute top-14 left-4 z-30 w-72 glass-strong rounded-2xl p-4 mono-glow animate-floatIn">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--text)]">Appearance</p>
        <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)] text-sm">✕</button>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-2">Theme</p>
      <div className="flex gap-2 mb-4">
        {[
          { key: "dark", label: "Dark", icon: "🌙" },
          { key: "light", label: "Light", icon: "☀️" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setMode(t.key)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-all flex flex-col items-center gap-1 ${
              mode === t.key ? "bg-[var(--surface-2)] border border-[var(--accent-1)]" : "bg-[var(--surface-1)] border border-[var(--border-1)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="text-[var(--text)]">{t.label}</span>
          </button>
        ))}
      </div>

      <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-2">Accent color</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {ACCENT_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => setAccent(c)}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{ background: c, borderColor: accent === c ? "var(--text)" : "transparent" }}
            title={c}
          />
        ))}
        <label className="w-7 h-7 rounded-full border border-[var(--border-2)] flex items-center justify-center cursor-pointer text-xs relative overflow-hidden">
          🎨
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
      <button onClick={resetAccent} className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text-dim)] transition-colors">
        Reset to default
      </button>
    </div>
  );
}
