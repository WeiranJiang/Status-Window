import { LoaderCircle, Sparkles } from "lucide-react";
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
    <div className="status-window-shell relative overflow-hidden rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-soft backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(252,235,245,0.7),_transparent_40%)]" />
      <div className="relative flex min-h-[600px] flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500 shadow-card">
            <Sparkles className="h-3.5 w-3.5" />
            Cozy productivity dashboard
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold text-slate-900">Welcome!</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
            Status Window keeps your study sessions, subjects, and progress in one soft little control room.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isSignup ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-card outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                placeholder="Study Hero"
                required
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-card outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              placeholder="you@example.com"
              type="email"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-card outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              placeholder={isSignup ? "Pick a cozy secret" : "Your password"}
              type="password"
              required
            />
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSignup ? "Create Account" : "Log In"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void onGoogleSubmit()}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-card transition hover:-translate-y-0.5 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Continue with Google
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-600">
          <span>{isSignup ? "Already have an account?" : "Need an account first?"}</span>
          <button
            type="button"
            onClick={() => onModeChange(isSignup ? "login" : "signup")}
            className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
          >
            {isSignup ? "Log In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
