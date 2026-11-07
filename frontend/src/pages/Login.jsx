import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Scale } from "lucide-react";
import { useAuth } from "../lib/auth";
import goldCoinsBg from "../assets/golden-coins-bg.jpg";

/**
 * Professional split-screen login page for Karigar Ledger.
 * - Left (55% width on desktop): Golden coins background image with subtle dark golden overlay,
 *   Karigar Ledger brand, headline, and glass-effect statistics card.
 * - Right (45% width on desktop): Warm ivory background (#F5F1E8) with centered login form,
 *   mustard-gold (#98701C) button, password toggle, and demo account shortcuts.
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
    <div className="min-h-[100dvh] w-full flex flex-col lg:grid lg:grid-cols-[55%_45%] antialiased bg-[#F5F1E8] text-[#171717] overflow-x-hidden font-sans">
      {/* LEFT SECTION (55% on desktop): Golden Coins background with dark golden overlay */}
      <div
        className="relative overflow-hidden flex flex-col justify-between p-6 sm:p-8 lg:p-14 text-white shrink-0 min-h-[140px] lg:min-h-[100dvh] bg-cover bg-center"
        style={{
          backgroundImage: `url(${goldCoinsBg})`,
        }}
      >
        {/* Subtle dark golden overlay for text readability & contrast */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#2A1D05]/65 via-[#3D2C08]/60 to-[#231703]/75 backdrop-blur-[1px] pointer-events-none"
          aria-hidden="true"
        />

        {/* Content container sitting safely above overlay */}
        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Top-left: Brand name & logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-sm">
              <Scale className="w-4 h-4 text-[#F6EDD2]" aria-hidden="true" />
            </div>
            <span className="text-lg lg:text-[22px] font-semibold tracking-tight text-white drop-shadow-sm">
              Karigar Ledger
            </span>
          </div>

          {/* Middle: Headline & Supporting Subtitle */}
          <div className="my-auto py-4 lg:py-12">
            <h1 className="text-xl sm:text-2xl lg:text-[34px] font-semibold text-white leading-tight max-w-[460px] m-0 drop-shadow-sm">
              Every gram, accounted for.
            </h1>
            <p className="hidden lg:block text-[16px] text-white/85 mt-3.5 max-w-[440px] m-0 leading-relaxed font-normal">
              Issue, receive and reconcile gold for every karigar, any day.
            </p>
          </div>

          {/* Bottom-left: Translucent glass-effect statistics card */}
          <div className="hidden lg:block max-w-[380px] w-full bg-white/[0.12] backdrop-blur-md border border-white/25 rounded-xl p-5 shadow-xl text-white">
            <div className="space-y-3 font-mono tabular-nums text-sm">
              <div className="flex justify-between items-center text-white/90">
                <span className="font-sans text-xs uppercase tracking-wider text-white/70">
                  Issued
                </span>
                <span className="font-medium text-[15px]">109.920 g</span>
              </div>
              <div className="flex justify-between items-center text-white/90">
                <span className="font-sans text-xs uppercase tracking-wider text-white/70">
                  Returned
                </span>
                <span className="font-medium text-[15px]">106.027 g</span>
              </div>
              <div className="flex justify-between items-center text-[#F6EDD2] font-semibold pt-2.5 border-t border-white/20">
                <span className="font-sans text-xs uppercase tracking-wider text-[#F6EDD2]/80">
                  Outstanding
                </span>
                <span className="text-[16px] font-bold">3.893 g</span>
              </div>
            </div>
            <div className="text-[11px] text-white/60 mt-3 font-sans flex items-center justify-between">
              <span>Sample workshop figures</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION (45% on desktop): Ivory/Cream Background (#F5F1E8) & Form */}
      <div className="flex-1 bg-[#F5F1E8] flex items-center justify-center p-6 sm:p-8 lg:p-14">
        <div className="w-full max-w-[370px] space-y-6">
          {/* Heading block */}
          <div>
            <h2 className="text-[26px] font-semibold text-[#171717] tracking-tight m-0">
              Sign in
            </h2>
            <p className="text-sm text-[#5F594E] mt-1.5 m-0">
              Use the account issued by your workshop
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-[#171717]">
                Email <span className="text-[#5F594E] text-xs select-none ml-0.5" aria-hidden="true">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="clerk@workshop.local"
                className="w-full h-11 px-3.5 bg-white border border-[#D9D1BF] rounded-lg text-sm text-[#171717] placeholder:text-muted/40 outline-none transition focus:border-[#98701C] focus:ring-2 focus:ring-[#98701C]/25 shadow-sm"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-[#171717]">
                Password <span className="text-[#5F594E] text-xs select-none ml-0.5" aria-hidden="true">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-11 px-3.5 pr-11 bg-white border border-[#D9D1BF] rounded-lg text-sm text-[#171717] placeholder:text-muted/40 outline-none transition focus:border-[#98701C] focus:ring-2 focus:ring-[#98701C]/25 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#5F594E] hover:text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#98701C] rounded-md transition cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Inline Error Message */}
            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
              >
                {error}
              </div>
            )}

            {/* Full-width Mustard-gold Sign in button (#98701C) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 px-4 inline-flex items-center justify-center gap-2 font-medium rounded-lg bg-[#98701C] text-white hover:bg-[#825F16] active:bg-[#725313] focus:outline-none focus:ring-2 focus:ring-[#98701C] focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition text-sm shadow-sm"
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

          {/* Demo account shortcut buttons & deployment note */}
          <div className="pt-2 text-center space-y-2.5">
            <div className="text-xs text-[#5F594E]">Prefill demo account:</div>
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickFill("clerk@workshop.local")}
                className="h-8 px-3.5 inline-flex items-center text-xs font-medium text-[#171717] bg-white border border-[#D9D1BF] hover:border-[#98701C] hover:text-[#98701C] rounded-md transition focus:outline-none focus:ring-2 focus:ring-[#98701C] cursor-pointer shadow-sm"
              >
                Issue Clerk
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("finance@workshop.local")}
                className="h-8 px-3.5 inline-flex items-center text-xs font-medium text-[#171717] bg-white border border-[#D9D1BF] hover:border-[#98701C] hover:text-[#98701C] rounded-md transition focus:outline-none focus:ring-2 focus:ring-[#98701C] cursor-pointer shadow-sm"
              >
                Finance Head
              </button>
            </div>
            <p className="text-xs text-[#5F594E] m-0 pt-1">
              Demo passwords are documented in deployment.md
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
