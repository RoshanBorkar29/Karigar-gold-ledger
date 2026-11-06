import React, { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import OfflineBanner from "../ui/OfflineBanner";
import PageHeader from "../ui/PageHeader";
import ErrorBoundary from "../ErrorBoundary";

/**
 * Standard AppShell layout.
 * Desktop: left sidebar 232px, content max-width 960px, padding 32px.
 * Phone (<1024px): top bar with menu button opening sheet, padding 16px.
 * Tap targets >= 44px. NO horizontal page scroll at 360px width.
 */
export default function AppShell({ title, subtitle, actions, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-ink flex flex-col font-sans antialiased overflow-x-hidden">
      {/* Persistent network offline status probe */}
      <OfflineBanner />

      <div className="flex-1 flex min-w-0">
        {/* Responsive Sidebar */}
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <header className="lg:hidden h-14 bg-surface border-b border-border px-4 flex items-center justify-between sticky top-0 z-20">
            <span className="text-base font-semibold text-ink tracking-tight">
              Karigar Ledger
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-muted hover:text-ink rounded bg-transparent border-none cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 stroke-[1.75]" />
            </button>
          </header>

          {/* Central container */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[960px] w-full mx-auto">
            <ErrorBoundary>
              {title && (
                <PageHeader
                  title={title}
                  description={subtitle}
                  action={actions}
                />
              )}
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
