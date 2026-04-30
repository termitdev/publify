// src/layouts/DashboardLayout.tsx
import { Outlet, useLocation } from "react-router-dom";
import { SidebarComponent } from "@/components/Sidebar";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

// ── Design Tokens ──────────────────────────────────────────────
const T = {
  primary:   '#003223',
  soft:      '#f5ebe1',
  card:      '#ffffff',
  border:    'rgba(0,0,0,0.05)',
  muted:     '#6b7280',
  ink:       '#111827',
  primaryLo: 'rgba(0,50,35,0.06)',
};

interface UserProfile {
  full_name:  string | null;
  email:      string | null;
  avatar_url: string | null;
}

// Rotas que devem ocupar 100% da tela (sem padding, sem topbar)
const FULLSCREEN_ROUTES = ['/dashboard/calendar'];

export default function DashboardLayout() {
  const location                     = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark,       setIsDark]     = useState(false);
  const [profile,      setProfile]    = useState<UserProfile | null>(null);

  const isFullscreen = FULLSCREEN_ROUTES.some(r => location.pathname.startsWith(r));

  // ── Theme ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setIsDark(true);
  }, []);

  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // ── Logged user ────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("user_id", user.id)
        .single();

      setProfile(
        data
          ? { full_name: data.full_name, email: data.email, avatar_url: (data as any).avatar_url ?? null }
          : { full_name: user.email?.split("@")[0] ?? "Usuário", email: user.email ?? null, avatar_url: null }
      );
    };

    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const initials = profile?.full_name
    ? profile.full_name.substring(0, 2).toUpperCase()
    : "??";

  return (
    <div className={`${isDark ? "dark" : ""} min-h-screen bg-background flex transition-colors duration-300`}>
      <SidebarComponent open={sidebarOpen} setOpen={setSidebarOpen} />

      <motion.main
        className="flex-1 transition-all duration-300 ease-in-out overflow-x-hidden"
        style={isFullscreen ? { display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh' } : {}}
        animate={{ marginLeft: sidebarOpen ? 256 : 64 }}
        initial={{ marginLeft: 64 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* ── Top Bar (oculta no modo fullscreen) ─────────── */}
        {!isFullscreen && (
          <div
            className="flex justify-end items-center gap-3 px-6 py-3 sticky top-0 z-30"
            style={{
              background:     'rgba(252,252,252,0.85)',
              backdropFilter: 'blur(12px)',
              borderBottom:   `1px solid ${T.border}`,
            }}
          >
            <ThemeToggle isDark={isDark} onToggle={handleToggleTheme} />

            {profile && (
              <div className="flex items-center gap-2.5 group relative">
                <div
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-colors cursor-default"
                  style={{ background: T.primaryLo }}
                >
                  <Avatar className="h-7 w-7 rounded-lg overflow-hidden flex-shrink-0">
                    <AvatarImage
                      src={
                        profile.avatar_url ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}`
                      }
                      className="object-cover"
                    />
                    <AvatarFallback
                      className="text-[9px] font-semibold rounded-lg"
                      style={{ background: T.soft, color: T.primary }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block leading-none">
                    <p className="text-xs font-medium" style={{ color: T.ink }}>
                      {profile.full_name ?? "Usuário"}
                    </p>
                    {profile.email && (
                      <p className="text-[9px]" style={{ color: T.muted }}>
                        {profile.email}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="h-8 w-8 flex items-center justify-center rounded-xl
                    opacity-0 group-hover:opacity-100 transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,100,0,0.08)', color: '#ff6400' }}
                  title="Sair"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Conteúdo ────────────────────────────────────── */}
        {isFullscreen
          ? (
            // Calendário: sem padding, ocupa todo o espaço restante
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Outlet />
            </div>
          ) : (
            // Demais páginas: padding normal
            <div className="p-4 sm:p-6 lg:p-8">
              <Outlet />
            </div>
          )
        }
      </motion.main>
    </div>
  );
}