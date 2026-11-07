import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";

/**
 * Calm, professional split-layout login page.
 * Left: Deep warm bronze brand panel with fine pattern and ledger preview.
 * Right: Clean form on warm parchment background (#F3EFE6) without card borders or shadows.
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const handleQuickFill = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("");
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] w-full grid grid-cols-1 lg:grid-cols-[55%_45%] antialiased bg-background">
      {/* LEFT: Brand panel */}
      <div
        className="relative overflow-hidden flex flex-col justify-between p-8 lg:p-12 text-[#FBF9F4]"
        style={{
          background: "linear-gradient(135deg, #6F5418 0%, #8A6A1F 100%)",
        }}
      >
        {/* Faint pattern: 1px line grid at 6% opacity + horizontal ingot bars at 8% opacity */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="brand-grid-pattern"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="#FBF9F4"
                strokeWidth="1"
                strokeOpacity="0.06"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#brand-grid-pattern)" />
          {/* Subtle ingot bars */}
          <rect x="12%" y="18%" width="120" height="4" rx="2" fill="#FBF9F4" fillOpacity="0.08" />
          <rect x="62%" y="24%" width="96" height="4" rx="2" fill="#FBF9F4" fillOpacity="0.08" />
          <rect x="36%" y="58%" width="144" height="4" rx="2" fill="#FBF9F4" fillOpacity="0.08" />
          <rect x="18%" y="72%" width="80" height="4" rx="2" fill="#FBF9F4" fillOpacity="0.08" />
          <rect x="58%" y="82%" width="112" height="4" rx="2" fill="#FBF9F4" fillOpacity="0.08" />
        </svg>

        {/* Slow decorative sweep: 1px line moving left-to-right every 9 seconds */}
        <div className="login-decorative-sweep-container" aria-hidden="true">
          <div className="login-decorative-sweep-track">
            <div className="login-decorative-sweep-line" />
          </div>
        </div>

        {/* Brand content */}
        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Top-left: Product name */}
          <div>
            <span className="font-sans text-[20px] font-semibold text-[#FBF9F4] tracking-tight">
              Karigar Ledger
            </span>
          </div>

          {/* Middle: Headline + Supporting line */}
          <div className="my-auto py-8">
            <h1 className="text-[32px] font-semibold text-[#FBF9F4] leading-tight max-w-[420px] m-0">
              Every gram, accounted for.
            </h1>
            <p className="text-[16px] text-[#FBF9F4]/80 mt-3 max-w-[420px] m-0 leading-relaxed font-normal">
              Issue, receive and reconcile gold for every karigar, any day.
            </p>
          </div>

          {/* Bottom: Ledger preview panel */}
          <div className="max-w-[380px] w-full bg-[#FBF9F4]/[0.10] border border-[#FBF9F4]/20 rounded-[8px] p-5">
            <div className="space-y-2.5 font-mono tabular-nums text-sm">
              <div className="login-row-1 flex justify-between items-center text-[#FBF9F4]">
                <span>Issued</span>
                <span>109.920 g</span>
              </div>
              <div className="login-row-2 flex justify-between items-center text-[#FBF9F4]">
                <span>Returned</span>
                <span>106.027 g</span>
              </div>
              <div className="login-row-3 flex justify-between items-center text-[#F6EDD2] font-semibold pt-2 border-t border-[#FBF9F4]/20">
                <span>Outstanding</span>
                <span>3.893 g</span>
              </div>
            </div>
            <div className="text-xs text-[#FBF9F4]/60 mt-3 font-sans">
              Sample figures
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Form side */}
      <div className="bg-background flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[360px] space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-[24px] font-semibold text-ink tracking-tight m-0">
              Sign in
            </h2>
            <p className="text-sm text-muted mt-1 m-0">
              Use the account issued by your workshop
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email <span className="text-muted text-xs select-none ml-0.5" aria-hidden="true">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clerk@workshop.local"
                className="w-full h-11 px-3 bg-white border border-[#D9D1BF] rounded text-sm text-ink placeholder:text-muted/40 outline-none transition focus:border-bronze focus:ring-2 focus:ring-bronze"
              />
            </div>

            {/* Password Field with Show/Hide toggle */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                Password <span className="text-muted text-xs select-none ml-0.5" aria-hidden="true">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-11 px-3 pr-10 bg-white border border-[#D9D1BF] rounded text-sm text-ink placeholder:text-muted/40 outline-none transition focus:border-bronze focus:ring-2 focus:ring-bronze"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-bronze rounded cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Inline Error Message directly above Sign in button */}
            {error && (
              <div
                role="alert"
                className="p-3 rounded bg-status-problem-tint border border-status-problem/20 text-status-problem text-xs font-medium"
              >
                {error}
              </div>
            )}

            {/* Sign in Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 font-medium rounded bg-bronze text-white hover:bg-bronze-hover active:bg-bronze-hover focus:outline-none focus:ring-2 focus:ring-bronze cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition text-sm shadow-none"
            >
              {loading && (
                <span
                  className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              <span>{loading ? "Signing in..." : "Sign in"}</span>
            </button>
          </form>

          {/* Prefill Demo Account Buttons */}
          <div className="pt-2 text-center space-y-2">
            <div className="text-xs text-muted">Prefill demo email:</div>
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickFill("clerk@workshop.local")}
                className="h-8 px-3 inline-flex items-center text-xs font-medium text-ink bg-surface border border-border hover:border-bronze rounded transition focus:outline-none focus:ring-2 focus:ring-bronze cursor-pointer shadow-none"
              >
                Issue Clerk
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("finance@workshop.local")}
                className="h-8 px-3 inline-flex items-center text-xs font-medium text-ink bg-surface border border-border hover:border-bronze rounded transition focus:outline-none focus:ring-2 focus:ring-bronze cursor-pointer shadow-none"
              >
                Finance Head
              </button>
            </div>
            <p className="text-xs text-muted m-0 pt-1">
              Demo passwords are documented in deployment.md
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
