import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Player, Match } from "@/lib/types";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ArrowLeft, TrendingUp, TrendingDown, Flame, Award, Shield, Swords, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();

  const { data: player } = useQuery({
    queryKey: ["player", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Player | null;
    },
    enabled: !!id,
  });

  const { data: rankInfo } = useQuery({
    queryKey: ["player-rank", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id")
        .eq("is_active", true)
        .order("score", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      const idx = (data ?? []).findIndex((p) => p.id === id);
      return { rank: idx >= 0 ? idx + 1 : null, total: data?.length ?? 0 };
    },
    enabled: !!id,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["player-matches", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(`winner_id.eq.${id},loser_id.eq.${id}`)
        .order("played_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Match[];
    },
    enabled: !!id,
  });

  const opponentIds = useMemo(
    () =>
      Array.from(
        new Set(matches.map((m) => (m.winner_id === id ? m.loser_id : m.winner_id))),
      ),
    [matches, id],
  );

  const { data: opponents = [] } = useQuery({
    queryKey: ["opponents", opponentIds.join(",")],
    queryFn: async () => {
      if (opponentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .in("id", opponentIds);
      if (error) throw error;
      return data as Pick<Player, "id" | "name">[];
    },
    enabled: opponentIds.length > 0,
  });

  const oppMap = useMemo(
    () => Object.fromEntries(opponents.map((o) => [o.id, o.name])),
    [opponents],
  );

  const stats = useMemo(() => {
    const pj = matches.length;
    const pg = matches.filter((m) => m.winner_id === id).length;
    const pp = pj - pg;
    const winRate = pj > 0 ? Math.round((pg / pj) * 100) : 0;
    let streak = 0;
    let streakWin = matches[0]?.winner_id === id;
    for (const m of matches) {
      const won = m.winner_id === id;
      if (won === streakWin) streak++;
      else break;
    }
    return { pj, pg, pp, winRate, streak, streakWin };
  }, [matches, id]);

  const { data: pointsBreakdown } = useQuery({
    queryKey: ["player-points-breakdown", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("winner_id, loser_id, points_exchanged")
        .or(`winner_id.eq.${id},loser_id.eq.${id}`);
      if (error) throw error;
      let won = 0;
      let lost = 0;
      for (const m of data ?? []) {
        if (m.winner_id === id) won += m.points_exchanged;
        else lost += m.points_exchanged;
      }
      return { won, lost, net: won - lost };
    },
    enabled: !!id,
  });

  if (!player) {
    return (
      <div className="text-center py-20 text-zinc-500 text-sm">Cargando perfil del atleta...</div>
    );
  }

  const startScore = player.initial_score ?? player.score;
  const diff = player.score - startScore;

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-zinc-400 hover:text-white hover:bg-white/10">
        <Link to="/">
          <ArrowLeft className="h-4 w-4 mr-1 text-red-500" /> Volver al ranking
        </Link>
      </Button>

      {/* ATHLETE MAIN CARD */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-red-600/10 blur-3xl rounded-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 md:gap-6 relative z-10 text-center sm:text-left">
          <PlayerAvatar player={player} size="xl" className="ring-4 ring-red-500/40 shadow-glow-red shrink-0" />

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight truncate">
              {player.name}
            </h1>
            <div className="text-sm font-medium text-zinc-400 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
              <Shield className="h-4 w-4 text-red-500" /> {player.club || "Atleta Independiente"}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {rankInfo?.rank && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full">
                  <Award className="h-3.5 w-3.5" /> Puesto #{rankInfo.rank} de {rankInfo.total}
                </span>
              )}
              {stats.streak > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border",
                    stats.streakWin
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-400 border-white/10"
                  )}
                >
                  <Flame className="h-3.5 w-3.5" /> Racha: {stats.streak} {stats.streakWin ? "V" : "D"}
                </span>
              )}
            </div>
          </div>

          <div className="sm:text-right shrink-0 bg-zinc-950/80 border border-white/10 p-4 rounded-2xl w-full sm:w-auto mt-2 sm:mt-0 shadow-inner">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Puntaje Elo</div>
            <div className="text-3xl md:text-4xl font-mono font-black text-red-500 tracking-tight">
              {player.score}
            </div>
            <div className="text-[11px] font-medium text-zinc-400 mt-0.5">
              {diff >= 0 ? `+${diff}` : diff} pts globales
            </div>
          </div>
        </div>
      </div>

      {/* KEY STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Puntos Iniciales"
          value={startScore}
          hint={diff === 0 ? "sin variacion" : diff > 0 ? `+${diff} ganados` : `${diff} perdidos`}
        />
        <StatCard label="Partidos Jugados" value={stats.pj} />
        <StatCard label="Victorias / Derrotas" value={`${stats.pg} V - ${stats.pp} D`} accent />
        <StatCard label="Efectividad" value={`${stats.winRate}%`} />
      </div>

      {/* POINTS BREAKDOWN */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Swords className="h-4 w-4 text-red-500" /> Desglose de Puntos (Art. 22)
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Puntos Ganados"
            value={`+${pointsBreakdown?.won ?? 0}`}
            accent
            hint="Suma en victorias"
          />
          <StatCard
            label="Puntos Perdidos"
            value={`-${pointsBreakdown?.lost ?? 0}`}
            hint="Suma en derrotas"
          />
          <StatCard
            label="Saldo Neto"
            value={
              (pointsBreakdown?.net ?? 0) >= 0
                ? `+${pointsBreakdown?.net ?? 0}`
                : `${pointsBreakdown?.net ?? 0}`
            }
            hint="Ganados − Perdidos"
          />
        </div>
      </section>

      {/* MATCH HISTORY FOR ATHLETE */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Calendar className="h-4 w-4 text-red-500" /> Historial Reciente de Partidos
        </h2>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden shadow-xl">
          {matches.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              Aún no hay partidos registrados para este atleta.
            </div>
          )}

          <div className="divide-y divide-white/5">
            {matches.map((m) => {
              const won = m.winner_id === id;
              const oppId = won ? m.loser_id : m.winner_id;
              const oppName = oppMap[oppId] ?? "Atleta";
              const sets = won
                ? `${m.winner_sets} - ${m.loser_sets}`
                : `${m.loser_sets} - ${m.winner_sets}`;

              return (
                <Link
                  to={`/jugador/${oppId}`}
                  key={m.id}
                  className="flex items-center gap-3.5 px-4 md:px-5 py-3.5 hover:bg-white/[0.04] transition-colors group"
                >
                  <span
                    className={cn(
                      "text-xs font-black w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border shadow-sm",
                      won
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}
                  >
                    {won ? "V" : "D"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-white group-hover:text-red-400 transition-colors truncate">
                      vs {oppName}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-medium">
                      {new Date(m.played_at).toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  <div className="text-xs md:text-sm font-bold font-mono text-zinc-200 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-white/10 shrink-0">
                    {sets}
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs font-black font-mono w-14 justify-end shrink-0",
                      won ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {won ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {won ? "+" : "-"}
                    {m.points_exchanged}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-sm">
      <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div
        className={cn(
          "text-xl md:text-2xl font-black font-mono mt-1 text-white tracking-tight",
          accent && "text-red-500"
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-zinc-400 mt-1 font-medium">{hint}</div>
      )}
    </div>
  );
}
