"use client";

import { Moon, SunDim } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export const AnimatedThemeToggler = ({ className }: Props) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Garante que só roda no client (Next.js friendly)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Pega do localStorage ou da classe do HTML
    const storedTheme = localStorage.getItem("theme");
    const hasDark =
      storedTheme === "dark" ||
      (!storedTheme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (hasDark) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }
  }, []);

  const changeTheme = async () => {
    if (!buttonRef.current) return;

    const toggleTheme = () => {
      const dark = document.documentElement.classList.toggle("dark");
      setIsDarkMode(dark);
      localStorage.setItem("theme", dark ? "dark" : "light");
    };

    // 🔹 Se não suportar startViewTransition, só troca
    const supportsViewTransition =
      typeof document !== "undefined" &&
      "startViewTransition" in document;

    if (!supportsViewTransition) {
      toggleTheme();
      return;
    }

    // @ts-ignore (ainda não tipado no TS)
    await document.startViewTransition(() => {
      flushSync(toggleTheme);
    }).ready;

    // 🔹 Animação circular
    const { top, left, width, height } =
      buttonRef.current.getBoundingClientRect();
    const y = top + height / 2;
    const x = left + width / 2;

    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRad}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 700,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  };

  return (
    <button
      ref={buttonRef}
      onClick={changeTheme}
      className={cn("p-2 rounded-full hover:bg-muted transition", className)}
      aria-label={isDarkMode ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDarkMode ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {isDarkMode ? <SunDim /> : <Moon />}
    </button>
  );
};
