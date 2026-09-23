import { useState } from "react";
import { login } from "../lib/api.js";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { user, error } = await login(username);
      if (error) throw new Error(error);
      onLogin(user);
    } catch (err) {
      setError("Could not connect to server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden -z-10 grid-overlay">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-white/8 blur-3xl" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass-strong gradient-border rounded-3xl p-10 w-full max-w-sm mono-glow animate-floatIn"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white via-zinc-300 to-zinc-500 flex items-center justify-center text-2xl font-bold text-black mono-glow mb-4 tracking-tight">
            L
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Leo</h1>
          <p className="text-sm text-white/40 mt-1">Your own private, local network chat</p>
        </div>

        <label className="block text-xs uppercase tracking-wider text-white/40 mb-2">
          Choose a username
        </label>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. mukul"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/25 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 transition-all"
          maxLength={24}
        />

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-white to-zinc-300 text-black font-semibold py-3 mono-glow hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Connecting…" : "Enter Chat"}
        </button>
      </form>
    </div>
  );
}
