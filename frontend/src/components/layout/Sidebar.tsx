import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Calendar,
  Package,
  ClipboardList,
  Database,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/units", icon: Building2, label: "Unidades" },
  { to: "/reservations", icon: CalendarDays, label: "Reservas" },
  { to: "/inventory", icon: Package, label: "Inventario" },
  { to: "/administrativo", icon: ClipboardList, label: "Administrativo" },
  { to: "/calendar", icon: Calendar, label: "Calendario" },
  { to: "/system", icon: Database, label: "Dados & Backup" },
];

const STORAGE_KEY = "guardian-sidebar";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "collapsed";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "open");
  }, [collapsed]);

  return (
    <aside
      className={`
        flex h-full flex-col border-r border-slate-200/60
        bg-white transition-all duration-300 ease-out
        dark:border-white/[0.06] dark:bg-zinc-950
        ${collapsed ? "w-[68px]" : "w-[240px]"}
      `}
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/60 px-4 dark:border-white/[0.06]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          {collapsed ? (
            <PanelLeft size={18} strokeWidth={1.5} />
          ) : (
            <PanelLeftClose size={18} strokeWidth={1.5} />
          )}
        </button>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="whitespace-nowrap text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                Guardian
              </p>
              <p className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-600">
                Sistema Local
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-2.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
              }`
            }
          >
            <Icon size={18} strokeWidth={1.5} className="shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200/60 p-2.5 dark:border-white/[0.06]">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
            }`
          }
        >
          <Settings size={18} strokeWidth={1.5} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Configuracoes
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>
      </div>
    </aside>
  );
}
