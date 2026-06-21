import { useEffect, useState } from "react";

export const adminShellFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
export const adminHeadingFont = { fontFamily: "'Lora', serif" };

export const adminTheme = {
  page: "bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white",
  panel:
    "bg-[#FFFDF8] border border-[#EDE8DF] shadow-[0_18px_45px_rgba(92,61,30,0.08)] dark:bg-[#121829] dark:border-[#1E293B] dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)]",
  mutedPanel: "bg-[#FFFBF5] border border-[#F2EDE4] dark:bg-[#161C2C] dark:border-[#222B40]",
  badge: "bg-[#FDE9C9] text-[#B8641A] dark:bg-[#10B981]/15 dark:text-[#00C896]",
  badgeSoft: "bg-[#FDF6EC] text-[#8B7355] dark:bg-[#1E293B] dark:text-slate-400",
  title: "text-[#2C1A0E] dark:text-white",
  subtitle: "text-[#8B7355] dark:text-slate-400",
  accent: "text-[#B8641A] dark:text-[#00C896]",
  accentBg: "bg-[#B8641A] dark:bg-[#00C896]",
  accentBorder: "border-[#E5C79D] dark:border-[#00C896]/20",
  cream: "bg-[#FDF6EC] dark:bg-[#1E293B]",
};

export const initTheme = () => {
  if (typeof window !== "undefined") {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
};

export const toggleTheme = () => {
  if (typeof window !== "undefined") {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      window.dispatchEvent(new Event("theme-changed"));
      return "light";
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      window.dispatchEvent(new Event("theme-changed"));
      return "dark";
    }
  }
  return "light";
};

export const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    window.addEventListener("theme-changed", handleThemeChange);
    return () => window.removeEventListener("theme-changed", handleThemeChange);
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme: () => {
      const nextTheme = toggleTheme();
      setTheme(nextTheme);
    },
  };
};

