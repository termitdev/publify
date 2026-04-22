import type { Config } from "tailwindcss";

const config: Config = {
  // Define que o modo escuro é ativado pela presença da classe "dark" no elemento pai
  darkMode: ["class"],
  // Caminhos para todos os componentes que utilizam classes do Tailwind
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    // Configurações do container padrão do projeto
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Mapeamento de variáveis CSS (HSL) para as classes do Tailwind
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "soft-background": "hsl(var(--soft-background))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
          dark: "hsl(var(--primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        subtle: "hsl(var(--subtle))",
        // Configurações específicas para a Sidebar do Dashboard
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      // Definição das fontes personalizadas (Ex: Outfit)
      fontFamily: {
        display: ["Outfit", "system-ui", "sans-serif"],
        body: ["Outfit", "system-ui", "sans-serif"],
      },
      // Gradients personalizados utilizados no Login e Hero
      backgroundImage: {
        "gradient-hero": "var(--gradient-hero)",
        "gradient-soft": "var(--gradient-soft)",
        "gradient-editorial": "var(--gradient-editorial)",
      },
      // Sombras personalizadas para a estética Premium
      boxShadow: {
        elegant: "var(--shadow-elegant)",
        hero: "var(--shadow-hero)",
        soft: "var(--shadow-soft)",
      },
      // Curvas de transição para animações suaves
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        bounce: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
      // Border Radius baseado na variável global --radius
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Definição de Keyframes para animações (Shadcn UI)
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      // Mapeamento das animações para classes
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  // Plugin para suporte a animações do Tailwind CSS
  plugins: [require("tailwindcss-animate")],
};

export default config;