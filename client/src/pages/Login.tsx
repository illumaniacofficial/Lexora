import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Lock, User, Loader2, AlertCircle } from "lucide-react";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/login", { username, password });
      onLogin();
    } catch (err: any) {
      setError(err.message?.includes("401") ? "Invalid credentials" : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center aurora-bg px-4" data-testid="login-page">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-6 w-6 text-purple-400" />
            <h1 className="text-2xl font-mono font-bold tracking-tight text-white">Lexora</h1>
            <Sparkles className="h-6 w-6 text-purple-400" />
          </div>
          <p className="text-xs font-mono text-stone-500 uppercase tracking-[0.3em]">Admin Console</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel rounded-xl border border-stone-800/50 p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20" data-testid="text-login-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-stone-400 uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 bg-stone-900/50 border-stone-700/50 text-white placeholder:text-stone-600 focus:border-purple-500/50 focus:ring-purple-500/20"
                placeholder="Enter username"
                autoComplete="username"
                data-testid="input-username"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-stone-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-stone-900/50 border-stone-700/50 text-white placeholder:text-stone-600 focus:border-purple-500/50 focus:ring-purple-500/20"
                placeholder="Enter password"
                autoComplete="current-password"
                data-testid="input-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-mono text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] disabled:opacity-50"
            data-testid="button-login"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Sign In
          </Button>
        </form>

        <p className="text-center text-[10px] font-mono text-stone-600 mt-6 tracking-wider">
          Powered by Lexora AI Publishing Platform
        </p>
      </div>
    </div>
  );
}
