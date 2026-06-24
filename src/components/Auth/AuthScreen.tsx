import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { AuthMode } from "../../types";

interface AuthScreenProps {
  loading: boolean;
  mode: AuthMode;
  errorMessage: string | null;
  onModeChange: (mode: AuthMode) => void;
  onEmailSubmit: (payload: { displayName: string; email: string; password: string }) => Promise<void>;
  onGoogleSubmit: () => Promise<void>;
}

export function AuthScreen({
  loading,
  mode,
  errorMessage,
  onModeChange,
  onEmailSubmit,
  onGoogleSubmit,
}: AuthScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignup = mode === "signup";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onEmailSubmit({ displayName, email, password });
  };

  return (
    <div className="flex h-[600px] w-full flex-col bg-[var(--bg)] px-6 py-10 selection:bg-blue-100">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-[var(--ink)]">
          {isSignup ? "Start Your Journey" : "Welcome Back"}
        </h1>
        <p className="mt-2 text-sm font-bold text-[var(--muted)] uppercase tracking-wider">
          {isSignup ? "Create your commander profile" : "Return to your study control room"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignup && (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="auth-input"
            placeholder="Explorer Name"
            required
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
          placeholder="Email address"
          type="email"
          required
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
          placeholder="Password"
          type="password"
          required
        />

        {errorMessage && (
          <div className="rounded-xl bg-red-50 p-3 text-center text-[11px] font-bold text-red-500">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--ink)] font-black tracking-tight text-white transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {loading && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {isSignup ? "ESTABLISH ACCOUNT" : "RESUME CONTROL"}
        </button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-black text-[var(--muted)]">
            <span className="bg-[var(--bg)] px-2">Secure Connection</span>
          </div>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void onGoogleSubmit()}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--paper)] font-black tracking-tight text-[var(--ink)] transition-all hover:brightness-[0.98] active:scale-[0.98]"
        >
          CONTINUE WITH GOOGLE
        </button>
      </form>

      <div className="mt-auto pt-6 text-center">
        <button
          type="button"
          onClick={() => onModeChange(isSignup ? "login" : "signup")}
          className="text-xs font-black uppercase tracking-widest text-[var(--sky-dark)] hover:underline"
        >
          {isSignup ? "I have an existing profile" : "I need a new identity"}
        </button>
      </div>
    </div>
  );
}
