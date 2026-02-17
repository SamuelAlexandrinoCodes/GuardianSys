import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "../ui/ThemeToggle";

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/80 px-8 backdrop-blur-xl dark:border-white/[0.06] dark:bg-zinc-950/80">
          <div />
          <ThemeToggle />
        </header>
        {/* Page content — never scrolls; inner components manage their own scroll */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
