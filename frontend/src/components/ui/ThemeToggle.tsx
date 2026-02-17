import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { motion } from "framer-motion";

const options = [
  { mode: "light" as const, icon: Sun, label: "Claro" },
  { mode: "dark" as const, icon: Moon, label: "Escuro" },
  { mode: "system" as const, icon: Monitor, label: "Sistema" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
      {options.map(({ mode: m, icon: Icon, label }) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className="relative rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
          title={label}
        >
          {mode === m && (
            <motion.div
              layoutId="theme-pill"
              className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-zinc-700"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            <Icon
              size={13}
              strokeWidth={1.8}
              className={
                mode === m
                  ? "text-slate-900 dark:text-zinc-100"
                  : "text-slate-400 dark:text-zinc-500"
              }
            />
          </span>
        </button>
      ))}
    </div>
  );
}
