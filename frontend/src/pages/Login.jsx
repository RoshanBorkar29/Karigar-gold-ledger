import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { useAuth } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.role === "finance_head") {
        navigate("/alerts");
      } else {
        navigate("/issues");
      }
    } catch (err) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail, quickPassword) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background gold glow accent */}
      <div className="absolute w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl -top-20 -left-20 pointer-events-none" />
      <div className="absolute w-96 h-96 bg-amber-600/10 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none" />

      <div className="w-full max-w-md card-glass p-8 border border-slate-800 relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 shadow-xl mb-4 gold-glow">
            <Coins className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
            Karigar Gold Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Workshop Fine-Gold Tracking & Old-Gold Compliance Desk
          </p>
        </div>

        {error && (
          <div className="mt-5 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clerk@workshop.local"
                className="input-base pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base pl-9"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gold py-2.5 mt-2"
          >
            {loading ? "Authenticating..." : "Sign In to Workshop"}
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </form>

        {/* Demo Fast Login Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center mb-3">
            Quick Switch Demo Roles
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("clerk@workshop.local", "clerk123")}
              className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-700 text-left transition"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                Issue Clerk
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                clerk@workshop.local
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("finance@workshop.local", "finance123")}
              className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-yellow-500/40 text-left transition"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Finance Head
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                finance@workshop.local
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
