import { useEffect, useRef, useState } from "react";
import { login } from "../lib/api.js";

const COUNTRY_CODES = ["+1", "+44", "+91", "+61", "+81", "+971", "+65"];

export default function Login({ onLogin }) {
  const [step, setStep] = useState("phone"); // phone -> otp -> username
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef([]);

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  function handlePhoneContinue(e) {
    e.preventDefault();
    if (phone.trim().length < 6) return;
    setStep("otp");
  }

  function handleOtpChange(i, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i, e) {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  function handleOtpContinue(e) {
    e.preventDefault();
    if (otp.some((d) => !d)) return;
    setStep("username");
  }

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

  const steps = ["phone", "otp", "username"];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="h-full w-full flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden -z-10 grid-overlay">
        <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-[var(--surface-2)] blur-3xl orb-drift" />
        <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-[var(--surface-2)] blur-3xl orb-drift-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[var(--surface-1)] blur-3xl" />
      </div>

      <div className="premium-card rounded-[2rem] p-10 w-full max-w-sm animate-floatIn relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl logo-metal flex items-center justify-center text-2xl font-bold text-black shadow-[0_10px_40px_-8px_rgba(255,255,255,0.5)] mb-4 tracking-tight relative overflow-hidden">
            <span className="relative z-10">L</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Leo</h1>
          <p className="text-sm text-[var(--text-faint)] mt-1">Your own private, local network chat</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-8">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === stepIndex ? "w-6 bg-[var(--accent-1)]" : i < stepIndex ? "w-4 bg-[var(--text-dim)]" : "w-4 bg-[var(--surface-3)]"
              }`}
            />
          ))}
        </div>

        {step === "phone" && (
          <form onSubmit={handlePhoneContinue} className="animate-floatIn">
            <label className="block text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">
              Phone number
            </label>
            <div className="premium-input rounded-xl flex items-center overflow-hidden">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="bg-transparent text-[var(--text)] pl-4 pr-2 py-3 outline-none border-r border-[var(--border-1)] text-sm"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c} className="bg-zinc-900">{c}</option>
                ))}
              </select>
              <input
                autoFocus
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
                placeholder="98765 43210"
                className="flex-1 bg-transparent px-3 py-3 text-[var(--text)] placeholder-[var(--text-faint)] outline-none"
                maxLength={16}
              />
            </div>
            <p className="text-[11px] text-[var(--text-ghost)] mt-2 px-1">
              For your account identity only — no SMS is sent, this stays on your device.
            </p>

            <button
              type="submit"
              disabled={phone.trim().length < 6}
              className="btn-mirror mt-6 w-full rounded-xl font-semibold py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpContinue} className="animate-floatIn">
            <label className="block text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">
              Verification code
            </label>
            <p className="text-sm text-[var(--text-dim)] mb-4">
              Enter the 4-digit code sent to {countryCode} {phone}
            </p>
            <div className="flex gap-3 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  inputMode="numeric"
                  maxLength={1}
                  className="premium-input rounded-xl w-14 h-14 text-center text-xl text-[var(--text)] outline-none"
                />
              ))}
            </div>
            <button type="button" onClick={() => setOtp(["", "", "", ""])} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-dim)] mt-3 block mx-auto transition-colors">
              Clear
            </button>

            <button
              type="submit"
              disabled={otp.some((d) => !d)}
              className="btn-mirror mt-6 w-full rounded-xl font-semibold py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="btn-mirror-ghost mt-3 w-full rounded-xl text-[var(--text-dim)] hover:text-[var(--text)] font-medium py-2.5 text-sm"
            >
              ← Change number
            </button>
          </form>
        )}

        {step === "username" && (
          <form onSubmit={handleSubmit} className="animate-floatIn">
            <label className="block text-xs uppercase tracking-wider text-[var(--text-faint)] mb-2">
              Choose a username
            </label>
            <div className="premium-input rounded-xl">
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. mukul"
                className="w-full bg-transparent px-4 py-3 text-[var(--text)] placeholder-[var(--text-faint)] outline-none"
                maxLength={24}
              />
            </div>

            {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="btn-mirror mt-6 w-full rounded-xl font-semibold py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Connecting…" : "Enter Chat"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
