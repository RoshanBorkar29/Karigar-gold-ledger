import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";

/**
 * Deterministic configuration for 9 decorative gold coins:
 * - 3 small (16 to 20px, opacity 0.35, blur 1.5px)
 * - 3 medium (26 to 30px, opacity 0.55, blur 0.5px)
 * - 3 large (36 to 42px, opacity 0.8, no blur)
 * Durations 14 to 24s, negative animation-delays, drift 20 to 50px, rotateY spin.
 */
const COINS_CONFIG = [
  { id: 1, size: 40, left: "14%", duration: "16s", delay: "-4.5s", drift: "35px", spin: 360, opacity: 0.8, blur: 0, staticTop: "15%" },
  { id: 2, size: 28, left: "28%", duration: "19s", delay: "-13.2s", drift: "-30px", spin: -360, opacity: 0.55, blur: 0.5, staticTop: "26%" },
  { id: 3, size: 18, left: "8%", duration: "22s", delay: "-2.8s", drift: "22px", spin: 360, opacity: 0.35, blur: 1.5, staticTop: "42%" },
  { id: 4, size: 38, left: "64%", duration: "20s", delay: "-11.4s", drift: "-40px", spin: -360, opacity: 0.8, blur: 0, staticTop: "52%" },
  { id: 5, size: 30, left: "48%", duration: "23s", delay: "-6.7s", drift: "45px", spin: 360, opacity: 0.55, blur: 0.5, staticTop: "68%" },
  { id: 6, size: 20, left: "38%", duration: "15s", delay: "-9.1s", drift: "-35px", spin: -360, opacity: 0.35, blur: 1.5, staticTop: "84%" },
  { id: 7, size: 42, left: "82%", duration: "18s", delay: "-8.3s", drift: "28px", spin: 360, opacity: 0.8, blur: 0, staticTop: "76%" },
  { id: 8, size: 26, left: "76%", duration: "17s", delay: "-15.0s", drift: "-25px", spin: -360, opacity: 0.55, blur: 0.5, staticTop: "36%" },
  { id: 9, size: 16, left: "90%", duration: "24s", delay: "-17.6s", drift: "30px", spin: 360, opacity: 0.35, blur: 1.5, staticTop: "20%" },
];

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
    <div className="min-h-[100dvh] w-full flex flex-col lg:grid lg:grid-cols-[55%_45%] antialiased bg-background overflow-x-hidden">
      {/* LEFT: Brand panel (compact 120px top strip on mobile, full column on desktop >=1024px) */}
      <div
        className="relative overflow-hidden flex flex-col justify-center lg:justify-between h-[120px] min-h-[120px] max-h-[120px] lg:h-full lg:min-h-[100dvh] lg:max-h-none p-4 sm:p-6 lg:p-12 text-[#FBF9F4] shrink-0"
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

        {/* Reusable inline SVG symbol for gold coin */}
        <svg
          className="hidden"
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0 }}
        >
          <defs>
            <radialGradient id="coin-gold-radial" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#F6EDD2" />
              <stop offset="45%" stopColor="#DFB94F" />
              <stop offset="100%" stopColor="#C9A441" />
            </radialGradient>
            <symbol id="gold-coin" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="url(#coin-gold-radial)" />
              <circle cx="50" cy="50" r="45.5" fill="none" stroke="#8A6A1F" strokeWidth="1.5" />
              <circle
                cx="50"
                cy="50"
                r="33.6"
                fill="none"
                stroke="#B8932F"
                strokeWidth="1"
                strokeOpacity="0.6"
              />
              <path
                d="M 23 44 A 32 32 0 0 1 44 23"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeOpacity="0.5"
              />
            </symbol>
          </defs>
        </svg>

        {/* Decorative falling gold coins layer (desktop only, masked over text areas) */}
        <div className="login-coins-layer hidden lg:block" aria-hidden="true">
          <div className="login-coins-headline-mask">
            <div className="login-coins-ledger-mask">
              <div className="login-coins-stage">
                {COINS_CONFIG.map((coin) => (
                  <div
                    key={coin.id}
                    className="coin-falling"
                    style={{
                      left: coin.left,
                      width: `${coin.size}px`,
                      height: `${coin.size}px`,
                      opacity: coin.opacity,
                      filter: coin.blur > 0 ? `blur(${coin.blur}px)` : undefined,
                      animationDuration: coin.duration,
                      animationDelay: coin.delay,
                      "--coin-drift": coin.drift,
                      "--coin-spin": `${coin.spin}deg`,
                      "--coin-static-top": coin.staticTop,
                    }}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full block"
                      aria-hidden="true"
                    >
                      <use href="#gold-coin" xlinkHref="#gold-coin" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Brand content */}
        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Top: Product name */}
          <div>
            <span className="font-sans text-sm sm:text-base lg:text-[20px] font-semibold text-[#FBF9F4] tracking-tight">
              Karigar Ledger
            </span>
          </div>

          {/* Middle: Headline + Supporting line */}
          <div className="my-0 lg:my-auto py-0 lg:py-8">
            <h1 className="text-base sm:text-lg lg:text-[32px] font-semibold text-[#FBF9F4] leading-tight max-w-[420px] m-0">
              Every gram, accounted for.
            </h1>
            <p className="hidden lg:block text-[16px] text-[#FBF9F4]/80 mt-3 max-w-[420px] m-0 leading-relaxed font-normal">
              Issue, receive and reconcile gold for every karigar, any day.
            </p>
          </div>

          {/* Bottom: Ledger preview panel (hidden on mobile under 1024px) */}
          <div className="hidden lg:block max-w-[380px] w-full bg-[#FBF9F4]/[0.10] border border-[#FBF9F4]/20 rounded-[8px] p-5">
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

      {/* RIGHT: Form side (fills remaining space with 16px padding on mobile) */}
      <div className="flex-1 bg-background flex items-center justify-center p-4 sm:p-6 lg:p-12">
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
