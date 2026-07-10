import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-300 transform active:scale-95 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
      aria-label="Toggle Theme"
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 transition-transform duration-500 rotate-0 hover:rotate-12" />
      ) : (
        <Sun className="w-5 h-5 transition-transform duration-500 rotate-0 hover:-rotate-12 text-amber-400" />
      )}
    </button>
  );
}
