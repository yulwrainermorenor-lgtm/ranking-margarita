import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Match, Player } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Pencil, CheckSquare, X, Trophy, Calendar, Swords, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { EditMatchDialog } from "@/components/EditMatchDialog";

export default function MatchHistory() {
  const [query, setQuery] = useState("");
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Match | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-match", {
        body: { match_id: matchId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Error");
      return data;
    },
    onSuccess: () => {
      toast.success("Partido eliminado");
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player-matches"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          supabase.functions.invoke("delete-match", { body: { match_id: id } }),
        ),
      );
      const failed = results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && (r.value.error || r.value.data?.error)),
      ).length;
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      if (failed === 0) toast.success(`${total} partidos eliminados`);
      else toast.warning(`${total - failed} eliminados, ${failed} fallaron`);
      setSelected(new Set());
      setSelectMode(false);
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player-matches"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("played_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Match[];
    },
  });

  const playerIds = useMemo(
    () => Array.from(new Set(matches.flatMap((m) => [m.winner_id, m.loser_id]))),
    [matches],
  );

  const { data: players = [] } = useQuery({
    queryKey: ["players-min", playerIds.join(",")],
    queryFn: async () => {
      if (playerIds.length === 0) return [];
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .in("id", playerIds);
      if (error) throw error;
      return data as Pick<Player, "id" | "name">[];
    },
    enabled: playerIds.length > 0,
  });

  const nameMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.name])),
    [players],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) => {
      const w = (nameMap[m.winner_id] ?? "").toLowerCase();
      const l = (nameMap[m.loser_id] ?? "").toLowerCase();
      return w.includes(q) || l.includes(q);
    });
  }, [matches, nameMap, query]);

  const grouped = useMemo(() => {
    const out: Record<string, Match[]> = {};
    for (const m of filtered) {
      (out[m.played_at] ??= []).push(m);
    }
    return out;
  }, [filtered]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 border border-white/10 p-5 md:p-6 rounded-2xl">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">
            Historial de <span className="text-red-500">Partidos</span>
          </h1>
          <p className="text-xs md:text-sm text-zinc-400">
            {matches.length} enfrentamientos oficiales registrados
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!selectMode ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-white/15 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white text-xs gap-1.5 rounded-xl font-medium"
                onClick={() => setSelectMode(true)}
              >
                <CheckSquare className="h-4 w-4 text-red-500" />
                Seleccionar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-white/15 bg-zinc-900 text-zinc-200 text-xs gap-1 rounded-xl"
                  onClick={() => {
                    setSelectMode(false);
                    setSelected(new Set());
                  }}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 bg-red-600 hover:bg-red-500 text-white text-xs gap-1.5 rounded-xl font-semibold shadow-glow-red"
                  disabled={selected.size === 0 || bulkDelete.isPending}
                  onClick={() => setBulkOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar ({selected.size})
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Filtrar por nombre de atleta..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11 bg-zinc-900/90 border-white/10 text-white placeholder:text-zinc-500 rounded-xl focus:border-red-500"
        />
      </div>

      {isLoading && (
        <div className="text-center text-sm text-zinc-500 py-12">
          Cargando partidos...
        </div>
      )}

      {!isLoading && matches.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-12 text-center">
          <Trophy className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <div className="text-base font-bold text-white mb-1">Aún no hay partidos registrados</div>
          <div className="text-xs text-zinc-400">
            Haz clic en &quot;Cargar Partido&quot; en la barra superior para agregar el primer resultado.
          </div>
        </div>
      )}

      {/* Chronological List grouped by Date */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([date, list]) => (
          <div key={date} className="space-y-2.5">
            <div className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5 px-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(date).toLocaleDateString("es-VE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 overflow-hidden divide-y divide-white/5 shadow-xl">
              {list.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 hover:bg-white/[0.04] transition-colors",
                    selected.has(m.id) && "bg-red-500/10 border-l-2 border-red-500"
                  )}
                >
                  {selectMode && (
                    <Checkbox
                      checked={selected.has(m.id)}
                      onCheckedChange={() => toggleOne(m.id)}
                      className="border-white/20 data-[state=checked]:bg-red-600"
                    />
                  )}

                  {/* Winner */}
                  <div className="flex-1 min-w-0 text-right">
                    <Link
                      to={`/jugador/${m.winner_id}`}
                      className="font-bold text-xs md:text-sm text-white hover:text-red-400 transition-colors truncate block"
                    >
                      {nameMap[m.winner_id] ?? "Atleta"}
                    </Link>
                  </div>

                  {/* Sets Score Badge */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-950 border border-white/15 shrink-0 shadow-inner">
                    <span className="font-mono font-black text-sm md:text-base text-emerald-400">
                      {m.winner_sets}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">vs</span>
                    <span className="font-mono font-black text-sm md:text-base text-zinc-400">
                      {m.loser_sets}
                    </span>
                  </div>

                  {/* Loser */}
                  <div className="flex-1 min-w-0 text-left">
                    <Link
                      to={`/jugador/${m.loser_id}`}
                      className="font-medium text-xs md:text-sm text-zinc-400 hover:text-white transition-colors truncate block"
                    >
                      {nameMap[m.loser_id] ?? "Atleta"}
                    </Link>
                  </div>

                  {/* Points exchanged badge */}
                  <div className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800 text-[11px] font-mono font-bold text-zinc-300 border border-white/10 shrink-0">
                    <Zap className="h-3 w-3 text-red-500 fill-red-500" /> +{m.points_exchanged} pts
                  </div>

                  {/* Admin actions */}
                  {isAdmin && !selectMode && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
                        onClick={() => setEditing(m)}
                        title="Editar resultado"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                            title="Eliminar partido"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar partido?</AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400 text-sm">
                              Se revertirán los {m.points_exchanged} puntos intercambiados según el Reglamento Nueva Esparta.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700">
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(m.id)}
                              className="bg-red-600 text-white hover:bg-red-500 font-semibold"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Match Modal */}
      <EditMatchDialog
        match={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />

      {/* Bulk Delete Modal */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} partidos?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-sm">
              Esta acción revertirá los puntos intercambiados en cada uno de estos encuentros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDelete.mutate(Array.from(selected))}
              className="bg-red-600 text-white hover:bg-red-500 font-semibold"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
