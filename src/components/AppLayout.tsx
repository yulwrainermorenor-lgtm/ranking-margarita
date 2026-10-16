import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Plus,
  UserPlus,
  ListOrdered,
  Activity,
  History,
  Download,
  Swords,
  Calculator,
  FileSpreadsheet,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import { AddPlayerDialog } from "@/components/AddPlayerDialog";
import { AdminLoginDialog } from "@/components/AdminLoginDialog";
import { useAuth } from "@/hooks/useAuth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);

  const tabs = [
    { to: "/", label: "Ranking", icon: ListOrdered },
    { to: "/general", label: "General", icon: Activity },
    { to: "/torneos", label: "Torneos", icon: Swords },
    { to: "/historial", label: "Historial", icon: History },
  ];

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-red-500/20 selection:text-red-200">
      {/* Header Bar */}
      <header
        className="border-b border-white/[0.08] bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30 transition-all"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="container mx-auto max-w-5xl px-4 flex h-14 md:h-16 items-center justify-between gap-3">
          {/* Logo & Brand Title with ATEMENE Image */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <img
              src="/atemene-logo.jpg"
              alt="ATEMENE Logo"
              className="h-9 w-9 md:h-10 md:w-10 rounded-xl object-cover border border-white/10 shadow-sm group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-sm md:text-base text-zinc-100 leading-none flex items-center gap-1.5">
                Ranking PP <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-semibold border border-red-500/20">ATEMENE</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-medium mt-0.5">Nueva Esparta</span>
            </div>
          </Link>

          {/* Navigation Bar (Desktop) - Minimalist Pills */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] p-1 rounded-xl">
            {tabs.map((t) => {
              const active = isActive(t.to);
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    active
                      ? "bg-zinc-800 text-white shadow-sm border border-white/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", active ? "text-red-500" : "text-zinc-400")} />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Quick Action & Admin Buttons */}
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigate("/verificar-puntos")}
                  className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"
                  title="Verificar Reglamento (art. 22)"
                >
                  <Calculator className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigate("/importar")}
                  className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"
                  title="Importar / Exportar Excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddPlayerOpen(true)}
                  className="h-8 border-white/10 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800 text-xs gap-1.5 rounded-lg font-medium"
                >
                  <UserPlus className="h-3.5 w-3.5 text-red-500" />
                  <span className="hidden sm:inline">Jugador</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setOpen(true)}
                  className="h-8 bg-red-600 hover:bg-red-500 text-white text-xs gap-1.5 rounded-lg font-medium shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cargar Partido</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setAdminLoginOpen(true)}
                  className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
                  title="Sesión Admin Activa"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAdminLoginOpen(true)}
                className="h-8 text-zinc-400 hover:text-white hover:bg-white/5 text-xs gap-1.5 rounded-lg"
              >
                <Lock className="h-3.5 w-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/instalar")}
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"
              title="Instalar App (PWA)"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-6 md:py-8 pb-24 md:pb-10">
        {children}
      </main>

      {/* Mobile Bottom Tab Navigation */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/[0.08] bg-[#09090b]/90 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4 h-14">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = isActive(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors",
                  active
                    ? "text-red-500"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-transform",
                    active && "stroke-[2.25]",
                  )}
                />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Dialog Modals */}
      <RecordMatchDialog open={open} onOpenChange={setOpen} />
      <AddPlayerDialog open={addPlayerOpen} onOpenChange={setAddPlayerOpen} />
      <AdminLoginDialog open={adminLoginOpen} onOpenChange={setAdminLoginOpen} />
    </div>
  );
}
