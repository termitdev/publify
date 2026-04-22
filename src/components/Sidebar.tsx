"use client";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calculator,
  BookOpen,
  Package,
  Edit3,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { flushSync } from "react-dom";

import logoHubEditorial from "@/assets/imgs/logotable.png";

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const SidebarComponent = ({ open, setOpen }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const themeBtnRef = useRef<HTMLButtonElement>(null);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("hub-theme") === "dark";
  });

  const toggleTheme = async () => {
    const next = !isDark;

    const apply = () => {
      setIsDark(next);
      localStorage.setItem("hub-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
    };

    // @ts-ignore
    if (!document.startViewTransition || !themeBtnRef.current) {
      apply();
      return;
    }

    // @ts-ignore
    const transition = document.startViewTransition(() => {
      flushSync(apply);
    });

    await transition.ready;
  };

  const isActive = (path: string) => location.pathname === path;

  const links = [
    { label: "Painel", href: "/dashboard", icon: LayoutDashboard },
    { label: "Calculadora", href: "/dashboard/calculadora", icon: Calculator },
    { label: "Referência", href: "/dashboard/referencia", icon: BookOpen },
    { label: "Logística", href: "/dashboard/logistica", icon: Package },
  ];

  return (
    <>
      {/* MOBILE */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-primary text-white border-t border-white/10 backdrop-blur-xl">
        <div className="flex justify-around items-center h-16">
          {links.map((link) => {
            const active = isActive(link.href);

            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 gap-1 transition",
                  active ? "text-white" : "text-white/60"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-xl transition",
                    active && "bg-white/10"
                  )}
                >
                  <link.icon className="h-5 w-5" />
                </div>

                <span className="text-[9px] uppercase font-medium">
                  {link.label}
                </span>
              </Link>
            );
          })}

          <button
            ref={themeBtnRef}
            onClick={toggleTheme}
            className="flex flex-col items-center flex-1 text-white/60"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="text-[9px] uppercase">Tema</span>
          </button>
        </div>
      </nav>

      {/* DESKTOP */}
      <aside
        className={cn(
          "hidden md:flex fixed top-0 left-0 h-full z-40 flex-col",
          "bg-primary text-primary-foreground",
          "transition-all duration-300",
          open ? "w-[260px]" : "w-[72px]"
        )}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {/* LOGO */}
        <div className="h-20 flex items-center px-4 border-b border-white/10">
          <SidebarLogo open={open} />
        </div>

        {/* LINKS */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {links.map((link) => {
            const active = isActive(link.href);

            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "group relative flex items-center h-11 rounded-xl px-2 transition-all",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                {/* Active indicator */}
                {active && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 w-[3px] h-6 bg-accent rounded-r-full"
                  />
                )}

                {/* Icon */}
                <div className="flex items-center justify-center min-w-[48px]">
                  <link.icon className="h-5 w-5 transition group-hover:scale-110" />
                </div>

                {/* Label */}
                <motion.span
                  animate={{ opacity: open ? 1 : 0, x: open ? 0 : -8 }}
                  className="text-sm whitespace-nowrap"
                >
                  {link.label}
                </motion.span>
              </Link>
            );
          })}
        </nav>

        {/* FOOTER */}
        <div className="p-3 border-t border-white/10 space-y-1">
          {/* Theme */}
          <button
            ref={themeBtnRef}
            onClick={toggleTheme}
            className="flex items-center w-full h-11 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <div className="flex items-center justify-center min-w-[48px]">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </div>

            <motion.span
              animate={{ opacity: open ? 1 : 0 }}
              className="text-sm whitespace-nowrap"
            >
              {isDark ? "Modo Claro" : "Modo Escuro"}
            </motion.span>
          </button>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/");
            }}
            className="flex items-center w-full h-11 rounded-xl text-red-400 hover:bg-red-500/10 transition"
          >
            <div className="flex items-center justify-center min-w-[48px]">
              <LogOut className="h-5 w-5" />
            </div>

            <motion.span
              animate={{ opacity: open ? 1 : 0 }}
              className="text-sm whitespace-nowrap"
            >
              Sair
            </motion.span>
          </button>
        </div>
      </aside>
    </>
  );
};

/* LOGO */

const SidebarLogo = ({ open }: { open: boolean }) => (
  <Link to="/dashboard" className="flex items-center gap-3 overflow-hidden">
    <img
      src={logoHubEditorial}
      className="h-10 w-auto object-contain brightness-0 invert"
    />

    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
        >
        </motion.div>
      )}
    </AnimatePresence>
  </Link>
);