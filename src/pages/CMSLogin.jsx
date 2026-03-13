import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { validatePassword, setAuthenticated, isAuthenticated } from "../lib/auth";
import { Lock, LogIn, AlertCircle } from "lucide-react";

export default function CMSLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) navigate("/cms/dashboard");
  }, [navigate]);

  function handleLogin() {
    setError("");
    if (validatePassword(password)) {
      setAuthenticated();
      navigate("/cms/dashboard");
    } else {
      setError("Invalid password");
    }
  }

  const inputStyle = { background: "var(--c-bg-primary)", color: "var(--c-text-primary)", border: "1px solid var(--c-border)" };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--c-bg-primary)" }}>
      <div className="terminal-window w-full max-w-md">
        <div className="terminal-header">
          <div className="terminal-dot" style={{ background: "#f87171" }} />
          <div className="terminal-dot" style={{ background: "#fbbf24" }} />
          <div className="terminal-dot" style={{ background: "#4ade80" }} />
          <span className="ml-3 text-xs font-mono" style={{ color: "var(--c-text-tertiary)" }}>cms — authenticate</span>
        </div>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock size={24} style={{ color: "var(--c-accent-primary)" }} />
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--c-text-primary)" }}>CMS Dashboard</h1>
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--c-text-secondary)" }}>Enter admin password to manage portfolio content.</p>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm font-mono" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--c-accent-danger)" }}>
              <AlertCircle size={16} />{error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--c-text-tertiary)" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••" className="w-full px-4 py-3 rounded-lg font-mono text-sm outline-none" style={inputStyle} />
            </div>
            <button onClick={handleLogin} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-mono text-sm font-medium transition-all duration-300 w-full justify-center" style={{ background: "var(--c-accent-primary)", color: "var(--c-bg-primary)" }}>
              <LogIn size={16} />Sign In
            </button>
          </div>
          <p className="mt-6 text-xs text-center font-mono" style={{ color: "var(--c-text-tertiary)" }}>Password configured via VITE_CMS_PASSWORD env variable</p>
        </div>
      </div>
    </div>
  );
}
