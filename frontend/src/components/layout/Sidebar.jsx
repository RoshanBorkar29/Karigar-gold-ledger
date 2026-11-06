import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  SendHorizontal,
  ArrowDownToLine,
  Scale,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  BadgePercent,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth";

/**
 * Standard Sidebar component.
 * Width: 232px on desktop.
 * Product name text-only: "Karigar Ledger".
 * Nav grouped as:
 * - Daily work (Issue, Receipt, Old gold)
 * - Records (Balances, Karigars)
 * - Owner only (Loss alerts, Daily stock) shown ONLY to finance head.
 * Active item: 2px bronze left marker and ink text (not a filled pill).
 * Footer: user name, role in plain text, Sign out as text button.
 */
export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout, isFinanceHead } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navGroups = [
    {
      title: "Daily work",
      items: [
        { label: "Issue", path: "/issues", icon: SendHorizontal },
        { label: "Receipt", path: "/receipts", icon: ArrowDownToLine },
        { label: "Old gold", path: "/old-gold", icon: BadgePercent },
      ],
    },
    {
      title: "Records",
      items: [
        { label: "Balances", path: "/balances", icon: Scale },
        { label: "Karigars", path: "/karigars", icon: Users },
      ],
    },
    ...(isFinanceHead
      ? [
          {
            title: "Owner only",
            items: [
              { label: "Loss alerts", path: "/alerts", icon: AlertTriangle },
              { label: "Daily stock", path: "/stock", icon: FileSpreadsheet },
            ],
          },
        ]
      : []),
  ];

  const formatRoleName = (role) => {
    if (role === "finance_head") return "Finance Head";
    if (role === "issue_clerk") return "Issue Clerk";
    return role || "User";
  };

  const content = (
    <div className="h-full flex flex-col justify-between bg-surface border-r border-border w-[232px] select-none">
      <div>
        {/* Brand Header: Text only, no graphic */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between">
          <span className="text-base font-semibold text-ink tracking-tight">
            Karigar Ledger
          </span>
          {isOpen && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 text-muted hover:text-ink min-w-[44px] min-h-[44px] flex items-center justify-center rounded"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5 stroke-[1.75]" />
            </button>
          )}
        </div>

        {/* Grouped Navigation */}
        <nav className="py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-6 text-xs text-muted font-normal uppercase-none">
                {group.title}
              </div>
              <ul className="list-none p-0 m-0 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors border-l-2 ${
                            isActive
                              ? "border-bronze text-ink font-medium bg-background"
                              : "border-transparent text-muted hover:text-ink hover:bg-background/50 font-normal"
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer: user name, role in plain text, Sign out as text button */}
      <div className="p-6 border-t border-border">
        {user ? (
          <div className="space-y-1">
            <div className="text-sm font-medium text-ink truncate">
              {user.full_name || user.email}
            </div>
            <div className="text-xs text-muted">
              {formatRoleName(user.role)}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-muted hover:text-ink hover:underline p-0 m-0 bg-transparent border-none cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-xs text-muted hover:text-ink hover:underline p-0 m-0 bg-transparent border-none cursor-pointer"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block w-[232px] shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile drawer backdrop and sheet */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-ink/20 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[232px] max-w-[80vw] h-full shadow-lg">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
