import React from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children, title, subtitle, actions }) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {(title || actions) && (
          <header className="px-8 py-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
            <div>
              {title && (
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}
        <div className="p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
