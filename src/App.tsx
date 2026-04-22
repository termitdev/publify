// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState, Suspense, lazy } from "react";
import { UiverseLoader } from "@/components/UiverseLoader";
import { SpeedInsights } from "@vercel/speed-insights/react";

// === ERROR BOUNDARY ===
import { ErrorBoundary } from "@/components/ErrorBoundary";

// === LAYOUTS ===
import Layout from "./components/Layout";
import DashboardLayout from "./layouts/DashboardLayout";

// === COMPONENTES ===
// Navigation removido daqui
import Footer from "./components/footer.tsx";

// === PÁGINAS (LAZY LOADING) ===
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const SubmitChapter = lazy(() => import("./pages/SubmitChapter"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CalculadoraEditorial = lazy(() => import("./pages/Calculadora"));
const ReferenceFormatter = lazy(() => import("./pages/Referencia"));
const Estoque = lazy(() => import("./pages/Estoque"));
const LogKanban = lazy(() => import("./components/LogKanban"));
const NotFound = lazy(() => import("./pages/NotFound"));

// === FORÇA FUSO SÃO PAULO ===
if (typeof window !== "undefined") {
  (Intl as any).DateTimeFormat = () => ({
    resolvedOptions: () => ({ timeZone: "America/Sao_Paulo" }),
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const TransitionWrapper = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (
        link?.getAttribute("href") === "/dashboard" &&
        location.pathname === "/"
      ) {
        e.preventDefault();
        setShowLoader(true);

        setTimeout(() => {
          navigate("/dashboard");
          setTimeout(() => setShowLoader(false), 500);
        }, 1000);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [location.pathname, navigate]);

  return (
    <>
      {showLoader && <UiverseLoader />}
      {children}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary
          fallback={
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background">
              <div className="bg-destructive/10 text-destructive p-4 rounded-full mb-4">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Erro inesperado</h2>
              <p className="text-muted-foreground mb-4">
                Tente recarregar a página ou volte mais tarde.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
              >
                Recarregar
              </button>
            </div>
          }
        >
          <TransitionWrapper>
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center bg-background">
                  <div className="flex items-center gap-3">
                    <UiverseLoader />
                    <span className="text-lg font-medium">Carregando...</span>
                  </div>
                </div>
              }
            >
              <div className="flex flex-col min-h-screen">
                <Routes>
                  {/* ROTAS PÚBLICAS */}
                  <Route
                    path="/"
                    element={
                      <Layout>
                        <Home />
                      </Layout>
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      <Layout>
                        <Login />
                      </Layout>
                    }
                  />
                  <Route
                    path="/submit"
                    element={
                      <Layout>
                        <SubmitChapter />
                      </Layout>
                    }
                  />

                  {/* DASHBOARD */}
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="calculadora" element={<CalculadoraEditorial />} />
                    <Route path="referencia" element={<ReferenceFormatter />} />
                    <Route path="logistica" element={<LogKanban />} />
                    <Route path="estoque" element={<Estoque />} />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>

                <Footer />
              </div>

              <SpeedInsights />
            </Suspense>
          </TransitionWrapper>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;