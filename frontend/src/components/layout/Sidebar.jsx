import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Coins,
  SendHorizontal,
  ArrowDownToLine,
  Scale,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  BadgePercent,
  LogOut,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../lib/auth";

export default function Sidebar() {
  const { user, logout, isFinanceHead } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    {
      label: "Gold Issues",
      path: "/issues",
      icon: SendHorizontal,
      roles: ["issue_clerk", "finance_head"],
    },
    {
      label: "Gold Receipts",
      path: "/receipts",
      icon: ArrowDownToLine,
      roles: ["issue_clerk", "finance_head"],
    },
    {
      label: "Karigar Balances",
      path: "/balances",
      icon: Scale,
      roles: ["issue_clerk", "finance_head"],
    },
    {
      label: "Karigar Master",
      path: "/karigars",
      icon: Users,
      roles: ["issue_clerk", "finance_head"],
    },
    {
      label: "Old-Gold Desk",
      path: "/old-gold",
      icon: BadgePercent,
      roles: ["issue_clerk", "finance_head"],
    },
    // Finance Head Only
    {
      label: "Loss Alerts",
      path: "/alerts",
      icon: AlertTriangle,
      roles: ["finance_head"],
      badge: "Owner",
    },
    {
      label: "Stock Statement",
      path: "/stock",
      icon: FileSpreadsheet,
      roles: ["finance_head"],
      badge: "Owner",
    },
  ];

  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-slate-950 shadow-md">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-yellow-400 leading-tight">
              Karigar Ledger
            </h1>
            <p className="text-[11px] text-slate-400">Coimbatore Workshop</p>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="mx-4 my-3 p-3 rounded-lg bg-slate-900 border border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-yellow-400 border border-slate-700 font-semibold text-xs">
                {user.full_name?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {user.full_name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isFinanceHead ? (
                    <span className="badge badge-gold text-[10px] py-0 px-1.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Finance Head
                    </span>
                  ) : (
                    <span className="badge badge-neutral text-[10px] py-0 px-1.5 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Issue Clerk
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation links */}
        <nav className="px-3 py-2 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="badge badge-gold text-[9px] py-0 px-1">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer & Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
