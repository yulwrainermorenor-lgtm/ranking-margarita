import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index.tsx";
import PlayerProfile from "./pages/PlayerProfile.tsx";
import MatchHistory from "./pages/MatchHistory.tsx";
import ActiveRanking from "./pages/ActiveRanking.tsx";
import Install from "./pages/Install.tsx";
import Auth from "./pages/Auth.tsx";
import Tournaments from "./pages/Tournaments.tsx";
import TournamentDetail from "./pages/TournamentDetail.tsx";
import VerifyPoints from "./pages/VerifyPoints.tsx";
import ImportData from "./pages/ImportData.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();
  if (location.pathname === "/auth") {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    );
  }
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/general" element={<ActiveRanking />} />
        <Route path="/jugador/:id" element={<PlayerProfile />} />
        <Route path="/historial" element={<MatchHistory />} />
        <Route path="/torneos" element={<Tournaments />} />
        <Route path="/torneos/:id" element={<TournamentDetail />} />
        <Route path="/verificar-puntos" element={<VerifyPoints />} />
        <Route path="/importar" element={<ImportData />} />
        <Route path="/instalar" element={<Install />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
