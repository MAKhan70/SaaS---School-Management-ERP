"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "dark" || pinned === "light") return pinned;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setTheme(currentTheme());
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, []);

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("nasaq-theme", next);
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      className="icon-button"
      type="button"
      onClick={toggleTheme}
      aria-label={`Use ${isDark ? "light" : "dark"} theme`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
