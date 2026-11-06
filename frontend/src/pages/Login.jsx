import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Field from "../components/ui/Field";
import Button from "../components/ui/Button";
import ErrorState from "../components/ErrorState";

/**
 * Clean, calm login screen.
 * Centred 360px panel, product name, email & password fields, one primary button.
 * Prefills email only for demo buttons.
 */
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

  const handleQuickFill = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 antialiased">
      <div className="w-full max-w-[360px] bg-surface border border-border rounded p-8">
        <div className="text-center pb-6 border-b border-border">
          <h1 className="text-xl font-semibold text-ink tracking-tight m-0">
            Karigar Ledger
          </h1>
          <p className="text-xs text-muted mt-1 m-0">
            Precision jewellery workshop ledger
          </p>
        </div>

        {error && (
          <ErrorState
            error={error}
            title="Sign in failed"
            message={error}
            className="my-4"
          />
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field
            label="Email"
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="clerk@workshop.local"
          />

          <Field
            label="Password"
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full"
            >
              Sign in
            </Button>
          </div>
        </form>

        {/* Demo Fast Account Selection */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-xs text-muted font-normal mb-3 text-center">
            Prefill demo account (email only)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill("clerk@workshop.local")}
              className="p-2.5 rounded border border-border bg-background hover:border-bronze text-left transition cursor-pointer"
            >
              <div className="text-xs font-medium text-ink">Issue Clerk</div>
              <div className="text-[11px] text-muted truncate mt-0.5">clerk@workshop.local</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("finance@workshop.local")}
              className="p-2.5 rounded border border-border bg-background hover:border-bronze text-left transition cursor-pointer"
            >
              <div className="text-xs font-medium text-ink">Finance Head</div>
              <div className="text-[11px] text-muted truncate mt-0.5">finance@workshop.local</div>
            </button>
          </div>
          <p className="text-[11px] text-muted text-center mt-3 m-0">
            Demo passwords are documented in deployment.md
          </p>
        </div>
      </div>
    </div>
  );
}
