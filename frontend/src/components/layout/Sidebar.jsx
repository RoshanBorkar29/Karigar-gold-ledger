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
 * Width: 220px.
 * Product name text-only: "Karigar Ledger".
 * Group labels: 12px muted with 24px space above each group.
 * Active item: 2px bronze left marker and ink text.
 * Footer: user's full name on line 1, role label on line 2 ("Issue clerk" / "Finance head" in sentence case),
 * Sign out as text button. Never repeats the same text twice.
 */
export default function Sidebar({ isOpen = false, onClose = () => { } }) {
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

  const getRoleLabel = (role) => {
    if (role === "finance_head") return "Finance head";
    if (role === "issue_clerk") return "Issue clerk";
    return role ? role.charAt(0).toUpperCase() + role.slice(1).replace("_", " ").toLowerCase() : "User";
  };

  const getDisplayName = (u) => {
    if (u?.full_name && u.full_name.trim()) {
      return u.full_name.trim();
    }
    if (u?.email) {
      const prefix = u.email.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return "User";
  };

  const roleLabel = getRoleLabel(user?.role);
  const displayName = getDisplayName(user);

  const content = (
    <div className="h-full flex flex-col justify-between bg-sidebar border-r border-sidebar-border w-[220px] select-none">
      <div>
        {/* Brand Header: Text only, no graphic */}
        <div className="h-14 px-5 border-b border-sidebar-border flex items-center justify-between">
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
        <nav className="py-2">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title} className={groupIdx === 0 ? "mt-3" : "mt-6"}>
              <div className="px-5 mb-1.5 text-xs text-muted font-normal select-none">
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
                          `flex items-center gap-3 px-5 py-2 text-sm transition-colors border-l-2 ${isActive
                            ? "border-bronze text-ink font-medium bg-background"
                            : "border-transparent text-muted hover:text-ink hover:bg-background/40 font-normal"
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

      {/* Footer: User full name on line 1, role label on line 2, Sign out text button */}
      <div className="p-5 border-t border-sidebar-border">
        {user ? (
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-ink truncate" title={displayName}>
              {displayName}
            </div>
            <div className="text-xs text-muted">
              {roleLabel}
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
      {/* Desktop fixed sidebar (position fixed, 100vh height, 220px width) */}
      <aside className="hidden lg:block fixed top-0 left-0 w-[220px] h-screen h-[100vh] z-30">
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
          <div className="relative z-10 w-[220px] max-w-[80vw] h-full shadow-lg">
            {content}
          </div>
        </div>
      )}
    </>
  );
    </>
  );
}
