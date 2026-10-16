import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Search, Medal, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 font-extrabold text-xs border border-amber-500/40">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-400/20 text-slate-300 font-bold text-xs border border-slate-400/30">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-700/20 text-amber-600 font-bold text-xs border border-amber-700/30">
        3
      </div>
    );
  }
  return (
    <div className="w-7 text-center font-mono text-xs font-semibold text-zinc-400">
      {rank}
    </div>
  );
}

export default function ActiveRanking() {
  const [query, setQuery] = useState("");

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("score", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Player[];
    },
  });

  const ranked = useMemo(
    () =>
      [...players]
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
        })
        .map((p, i) => ({ ...p, rank: i + 1 })),
    [players],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.club ?? "").toLowerCase().includes(q),
    );
  }, [ranked, query]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 border border-white/10 p-5 md:p-6 rounded-2xl flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">
              Ranking <span className="text-red-500">General</span>
            </h1>
          </div>
          <p className="text-xs md:text-sm text-zinc-400">
            {ranked.length} atletas registrados en la federación
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Buscar atleta o club..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11 bg-zinc-900/90 border-white/10 text-white placeholder:text-zinc-500 rounded-xl focus:border-red-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/70 overflow-hidden shadow-xl">
        <div className="hidden md:grid grid-cols-[3.5rem_1fr_9rem_7rem] px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-white/10 bg-zinc-900">
          <div className="text-center">Pos</div>
          <div>Atleta</div>
          <div>Club</div>
          <div className="text-right">Puntaje</div>
        </div>

        {isLoading && (
          <div className="p-12 text-center text-zinc-500 text-sm">Cargando...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center text-zinc-500 text-sm">Sin resultados.</div>
        )}

        <div className="divide-y divide-white/5">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/jugador/${p.id}`}
              className="grid grid-cols-[3rem_1fr_6rem] md:grid-cols-[3.5rem_1fr_9rem_7rem] items-center px-4 md:px-5 py-3.5 hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center justify-center">
                <RankBadge rank={p.rank} />
              </div>

              <div className="flex items-center gap-3 min-w-0 pr-2">
                <PlayerAvatar player={p} size="sm" className="group-hover:scale-105 transition-transform" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white group-hover:text-red-400 transition-colors truncate">
                    {p.name}
                  </div>
                  <div className="md:hidden text-[11px] text-zinc-400 truncate">
                    {p.club || "Sin club"}
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-xs font-medium text-zinc-400 truncate">
                {p.club || "Independiente"}
              </div>

              <div className="text-right font-mono font-bold text-sm text-white">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-white/10 text-white font-mono">
                  {p.score}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
