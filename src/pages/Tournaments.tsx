import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tournament } from "@/lib/types";
import { FORMAT_LABEL, STATUS_LABEL } from "@/lib/bracket";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Trash2, Swords, Calendar } from "lucide-react";
import { toast } from "sonner";
import { CreateTournamentDialog } from "@/components/CreateTournamentDialog";

export default function Tournaments() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tournament[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tournaments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Torneo eliminado");
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 border border-white/10 p-5 md:p-6 rounded-2xl">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">
            Torneos <span className="text-red-500">Estadales</span>
          </h1>
          <p className="text-xs md:text-sm text-zinc-400">
            Competencias y cuadros eliminatorios del Estado Nueva Esparta
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={() => setOpen(true)}
            className="h-10 bg-red-600 hover:bg-red-500 text-white text-xs gap-1.5 rounded-xl font-bold shadow-glow-red shrink-0"
          >
            <Plus className="h-4 w-4" /> Crear Torneo
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-zinc-500 py-12">Cargando torneos...</div>
      ) : tournaments.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-12 text-center">
          <Swords className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
          <div className="text-base font-bold text-white mb-1">No hay torneos registrados</div>
          <div className="text-xs text-zinc-400">Crea el primer torneo oficial usando el botón superior.</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 flex items-start justify-between gap-4 hover:border-red-500/40 transition-all hover:shadow-lg group relative overflow-hidden"
            >
              <Link to={`/torneos/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-base text-white group-hover:text-red-400 transition-colors truncate">
                    {t.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      t.status === "in_progress"
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : t.status === "finished"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400 border-white/10"
                    }`}
                  >
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 flex items-center gap-2">
                  <span>{FORMAT_LABEL[t.format]}</span>
                  {t.start_date && (
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Calendar className="h-3 w-3" /> {t.start_date}
                    </span>
                  )}
                </div>
              </Link>
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg shrink-0"
                  onClick={() => {
                    if (confirm(`¿Eliminar torneo "${t.name}"?`)) del.mutate(t.id);
                  }}
                  title="Eliminar torneo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateTournamentDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(id) => navigate(`/torneos/${id}`)}
      />
    </div>
  );
}