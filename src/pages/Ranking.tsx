import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Search, Medal, Pencil, Download, Crown, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { EditPlayerDialog } from "@/components/EditPlayerDialog";
import { resetAllData } from "@/lib/dataStore";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/10 text-amber-400 font-bold text-xs border border-amber-500/20">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-400/10 text-slate-300 font-bold text-xs border border-slate-400/20">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-700/10 text-amber-600 font-bold text-xs border border-amber-700/20">
        3
      </span>
    );
  }
  return (
    <span className="w-6 text-center font-mono text-xs font-medium text-zinc-500">
      {rank}
    </span>
  );
}

export default function Ranking() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("is_active", true)
        .order("score", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Player[];
    },
  });

  const ranked = useMemo(() => {
    const sorted = [...players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
    return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
  }, [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.club ?? "").toLowerCase().includes(q)
    );
  }, [ranked, query]);

  const top3 = ranked.slice(0, 3);

  const handleExport = () => {
    if (!ranked.length) {
      toast.error("No hay jugadores activos para exportar");
      return;
    }
    const rows = ranked.map((p) => ({
      Puesto: p.rank,
      Atleta: p.name,
      Club: p.club ?? "",
      Puntaje: p.score,
      "Puntaje inicial": p.initial_score ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activos");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ranking-margarita-${today}.xlsx`);
    toast.success(`${ranked.length} atletas exportados a Excel`);
  };

  const handleReset = () => {
    if (window.confirm("¿Restablecer datos originales del ranking?")) {
      resetAllData();
      queryClient.invalidateQueries();
      toast.success("Datos restablecidos al estado original");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Ranking Estadal <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal border border-white/5">ATEMENE</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Reglamento Oficial de Tenis de Mesa Nueva Esparta · {ranked.length} Atletas activos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 border-white/10 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 text-xs gap-1.5 rounded-lg"
          >
            <Download className="h-3.5 w-3.5 text-zinc-400" />
            <span>Exportar</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="h-8 w-8 text-zinc-500 hover:text-white rounded-lg"
            title="Restablecer datos originales"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* MINIMALIST TOP 3 PODIUM */}
      {top3.length === 3 && (
        <div className="grid grid-cols-3 gap-3 md:gap-4 items-end pt-2">
          {[top3[1], top3[0], top3[2]].map((p) => {
            const rank = p.rank;
            const isFirst = rank === 1;

            return (
              <Link
                key={p.id}
                to={`/jugador/${p.id}`}
                className={cn(
                  "rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4 md:p-5 flex flex-col items-center text-center transition-all duration-200 group hover:border-white/20 hover:bg-zinc-900/70",
                  isFirst && "bg-zinc-900/80 border-amber-500/30 md:py-6 order-2",
                  rank === 2 && "order-1",
                  rank === 3 && "order-3"
                )}
              >
                {/* Crown / Badge */}
                <div className="mb-2">
                  {isFirst ? (
                    <Crown className="h-5 w-5 text-amber-400" />
                  ) : (
                    <Medal
                      className={cn(
                        "h-4 w-4",
                        rank === 2 ? "text-slate-300" : "text-amber-600"
                      )}
                    />
                  )}
                </div>

                {/* Avatar */}
                <PlayerAvatar
                  player={p}
                  size={isFirst ? "lg" : "md"}
                  className="mb-2 group-hover:scale-105 transition-transform"
                />

                {/* Name */}
                <div className="text-xs md:text-sm font-semibold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                  {p.name}
                </div>

                {/* Club */}
                <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-full">
                  {p.club || "Independiente"}
                </div>

                {/* Rating Score */}
                <div
                  className={cn(
                    "mt-3 text-sm md:text-lg font-bold font-mono tracking-tight",
                    isFirst ? "text-amber-400" : "text-zinc-200"
                  )}
                >
                  {p.score} <span className="text-[10px] font-normal text-zinc-500">pts</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* SEARCH INPUT */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Buscar por atleta o club..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-10 bg-zinc-900/50 border-white/[0.08] text-white text-xs placeholder:text-zinc-500 rounded-xl focus:border-red-500/50"
        />
      </div>

      {/* MINIMALIST RANKING TABLE */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 overflow-hidden">
        <div className="hidden md:grid grid-cols-[3rem_1fr_9rem_7rem_auto] px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-white/[0.08] bg-zinc-950/40">
          <div className="text-center">#</div>
          <div>Atleta</div>
          <div>Club</div>
          <div className="text-right">Puntaje Elo</div>
          <div className="w-8"></div>
        </div>

        {isLoading && (
          <div className="p-8 text-center text-zinc-500 text-xs">Cargando datos del ranking...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-xs">No se encontraron atletas.</div>
        )}

        <div className="divide-y divide-white/[0.05]">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[2.5rem_1fr_5rem_auto] md:grid-cols-[3rem_1fr_9rem_7rem_auto] items-center px-4 py-3 hover:bg-white/[0.03] transition-colors group"
            >
              <Link to={`/jugador/${p.id}`} className="contents">
                <div className="flex items-center justify-center">
                  <RankBadge rank={p.rank} />
                </div>

                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <PlayerAvatar player={p} size="sm" />
                  <div className="min-w-0">
                    <div className="font-medium text-xs md:text-sm text-zinc-100 group-hover:text-red-400 transition-colors truncate">
                      {p.name}
                    </div>
                    <div className="md:hidden text-[10px] text-zinc-500 truncate">
                      {p.club || "Independiente"}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block text-xs text-zinc-400 truncate">
                  {p.club || "Independiente"}
                </div>

                <div className="text-right font-mono font-semibold text-xs md:text-sm text-zinc-200">
                  {p.score}
                </div>
              </Link>

              <div className="flex items-center justify-end">
                {isAdmin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:text-white rounded-lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditing(p);
                    }}
                    title={`Editar a ${p.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                ) : (
                  <div className="w-7" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <EditPlayerDialog
        player={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}
