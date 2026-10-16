import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/lib/types";
import { POINTS_TABLE, pointsForMatch } from "@/lib/points";
import {
  computeScoreDrift,
  repairScoresFromLog,
  type DriftReport,
} from "@/lib/dataStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, CheckCircle2, AlertCircle, ShieldCheck, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

function PlayerSelect({
  players,
  value,
  onChange,
  placeholder,
  excludeId,
}: {
  players: Player[];
  value: string | undefined;
  onChange: (id: string) => void;
  placeholder: string;
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = players.find((p) => p.id === value);
  const filtered = players.filter((p) => p.id !== excludeId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal bg-zinc-900 border-white/10 text-white hover:bg-zinc-800">
          {selected ? `${selected.name} (${selected.score} pts)` : <span className="text-zinc-500">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-red-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-zinc-900 border-white/10 text-white" align="start">
        <Command className="bg-zinc-900 text-white">
          <CommandInput placeholder="Buscar atleta..." className="text-white placeholder:text-zinc-500" />
          <CommandList className="max-h-60">
            <CommandEmpty className="p-3 text-xs text-zinc-500">Sin resultados.</CommandEmpty>
            <CommandGroup>
              {filtered.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className="hover:bg-white/10 text-white font-medium"
                >
                  <Check className={cn("mr-2 h-4 w-4 text-red-500", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{p.name}</span>
                  <span className="text-xs text-zinc-400 font-mono">{p.score} pts</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type Result = {
  expectedDelta: number;
  actualDelta: number;
  winnerBefore: number;
  winnerAfter: number;
  loserBefore: number;
  loserAfter: number;
  winnerName: string;
  loserName: string;
};

export default function VerifyPoints() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const [winnerId, setWinnerId] = useState<string>();
  const [loserId, setLoserId] = useState<string>();
  const [winnerSets, setWinnerSets] = useState(3);
  const [loserSets, setLoserSets] = useState(0);
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<Result | null>(null);
  const [report, setReport] = useState<DriftReport | null>(null);

  const winner = players.find((p) => p.id === winnerId);
  const loser = players.find((p) => p.id === loserId);

  const preview = useMemo(() => {
    if (!winner || !loser) return null;
    const diff = Math.abs(winner.score - loser.score);
    const winnerIsHigher = winner.score >= loser.score;
    const delta = pointsForMatch(winner.score, loser.score);
    return { diff, winnerIsHigher, delta };
  }, [winner, loser]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!winner || !loser) throw new Error("Faltan jugadores");
      const expected = pointsForMatch(winner.score, loser.score);
      const { data, error } = await supabase.functions.invoke("record-match", {
        body: {
          winner_id: winnerId,
          loser_id: loserId,
          winner_sets: winnerSets,
          loser_sets: loserSets,
          played_at: playedAt,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Error");
      const match = data.match;
      return {
        expectedDelta: expected,
        actualDelta: match.points_exchanged,
        winnerBefore: match.winner_score_before,
        winnerAfter: match.winner_score_after,
        loserBefore: match.loser_score_before,
        loserAfter: match.loser_score_after,
        winnerName: winner.name,
        loserName: loser.name,
      } satisfies Result;
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["player-matches"] });
      toast.success(`Verificado correctamente: ±${r.actualDelta} pts según reglamento art. 22`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const canSubmit = winnerId && loserId && winnerSets > loserSets;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 border border-white/10 p-5 md:p-6 rounded-2xl">
        <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">
          Verificar <span className="text-red-500">Reglamento (Art. 22)</span>
        </h1>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">
          Calculadora y verificador de puntos de intercambio oficial del Estado Nueva Esparta
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <Calculator className="h-5 w-5 text-red-500" /> Probar Partido
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-zinc-400">Ganador</Label>
            <PlayerSelect players={players} value={winnerId} onChange={setWinnerId} placeholder="Seleccionar atleta ganador" excludeId={loserId} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-zinc-400">Perdedor</Label>
            <PlayerSelect players={players} value={loserId} onChange={setLoserId} placeholder="Seleccionar atleta perdedor" excludeId={winnerId} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-zinc-400">Sets G</Label>
              <Input type="number" min={0} max={7} value={winnerSets} onChange={(e) => setWinnerSets(Number(e.target.value))} className="bg-zinc-900 border-white/10 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-zinc-400">Sets P</Label>
              <Input type="number" min={0} max={7} value={loserSets} onChange={(e) => setLoserSets(Number(e.target.value))} className="bg-zinc-900 border-white/10 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-zinc-400">Fecha</Label>
              <Input type="date" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} className="bg-zinc-900 border-white/10 text-white" />
            </div>
          </div>

          {preview && (
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-zinc-400"><span>Diferencia de R:</span><span className="text-white font-bold">{preview.diff} pts</span></div>
              <div className="flex justify-between text-zinc-400"><span>Ganador es:</span><span className="text-white font-bold">{preview.winnerIsHigher ? "Mayor Ranking (Favorito)" : "Menor Ranking (Sorpresa)"}</span></div>
              <div className="flex justify-between text-red-400 font-bold border-t border-white/10 pt-1.5"><span>Puntos a Intercambiar:</span><span>±{preview.delta} pts</span></div>
            </div>
          )}

          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()} className="w-full h-10 bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-glow-red rounded-xl">
            {mutation.isPending ? "Registrando..." : "Registrar y Verificar Intercambio"}
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
            <CheckCircle2 className="h-5 w-5" /> Verificado Correctamente
          </div>
          <div className="text-xs font-mono space-y-2 text-zinc-200">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span>{result.winnerName}:</span>
              <span className="font-bold">{result.winnerBefore} → <span className="text-emerald-400">{result.winnerAfter}</span> (+{result.actualDelta})</span>
            </div>
            <div className="flex justify-between">
              <span>{result.loserName}:</span>
              <span className="font-bold">{result.loserBefore} → <span className="text-red-400">{result.loserAfter}</span> (-{result.actualDelta})</span>
            </div>
          </div>
        </div>
      )}

      {/* Auditoría del historial: el log debe explicar todos los puntajes */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <ShieldCheck className="h-5 w-5 text-red-500" /> Auditoría del historial
        </div>
        <p className="text-xs text-zinc-400">
          Rehace todos los partidos en orden de fecha y compara el puntaje guardado con el
          que debería tener cada atleta. Si hay diferencias, se pueden recalcular.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-white/15 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs rounded-xl font-medium"
            onClick={() => {
              const r = computeScoreDrift();
              setReport(r);
              if (r.drift.length === 0 && r.matchesChanged === 0) {
                toast.success(`Historial coherente: ${r.playersInLog} atletas y sus partidos cuadran`);
              } else {
                toast.warning(
                  `${r.drift.length} atletas con diferencias (máx. ${r.maxDiff} pts) y ${r.matchesChanged} partidos inconsistentes`,
                );
              }
            }}
          >
            Analizar historial
          </Button>

          {report && (report.drift.length > 0 || report.matchesChanged > 0) && (
            <Button
              size="sm"
              className="h-9 bg-red-600 hover:bg-red-500 text-white text-xs rounded-xl font-bold shadow-glow-red"
              onClick={() => {
                const ok = window.confirm(
                  `Se van a recalcular ${report.drift.length} atletas y reescribir ${report.matchesChanged} partidos del historial. ¿Continuar?`,
                );
                if (!ok) return;
                const applied = repairScoresFromLog();
                setReport(computeScoreDrift());
                qc.invalidateQueries();
                toast.success(
                  `Recalculado: ${applied.playersFixed} atletas y ${applied.matchesFixed} partidos corregidos`,
                );
              }}
            >
              Recalcular puntajes
            </Button>
          )}
        </div>

        {report && (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 text-xs font-mono space-y-1.5">
              <div className="flex justify-between text-zinc-400">
                <span>Atletas en el historial:</span>
                <span className="text-white font-bold">{report.playersInLog}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Atletas con puntaje distinto al recalculado:</span>
                <span className={report.drift.length ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                  {report.drift.length}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Partidos con datos inconsistentes:</span>
                <span className={report.matchesChanged ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                  {report.matchesChanged}
                </span>
              </div>
              {report.drift.length > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Diferencia máxima:</span>
                  <span className="text-white font-bold">{report.maxDiff} pts</span>
                </div>
              )}
            </div>

            {report.drift.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-left text-zinc-400 border-b border-white/10 bg-zinc-900 uppercase">
                      <th className="py-2 px-4 font-bold">Atleta</th>
                      <th className="py-2 px-4 font-bold text-right">Guardado</th>
                      <th className="py-2 px-4 font-bold text-right">Según historial</th>
                      <th className="py-2 px-4 font-bold text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-200">
                    {report.drift.slice(0, 20).map((d) => (
                      <tr key={d.playerId}>
                        <td className="py-2 px-4 text-white">{d.name}</td>
                        <td className="py-2 px-4 text-right">{d.stored}</td>
                        <td className="py-2 px-4 text-right">{d.expected}</td>
                        <td className={`py-2 px-4 text-right font-bold ${d.diff > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {d.diff > 0 ? `+${d.diff}` : d.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.drift.length > 20 && (
                  <div className="px-4 py-2 text-[11px] text-zinc-500 border-t border-white/10">
                    Se muestran los 20 atletas con mayor diferencia de {report.drift.length}.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Official Rule Table */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <ShieldCheck className="h-5 w-5 text-red-500" /> Tabla del Reglamento Oficial (Art. 22)
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-white/10 bg-zinc-900 uppercase">
                <th className="py-2.5 px-4 font-bold">Diferencia de R</th>
                <th className="py-2.5 px-4 font-bold text-right">Gana Mayor R</th>
                <th className="py-2.5 px-4 font-bold text-right text-red-400">Gana Menor R (Sorpresa)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-200">
              {POINTS_TABLE.map((row) => (
                <tr key={row.range} className="hover:bg-white/[0.04]">
                  <td className="py-2.5 px-4 font-bold text-white">{row.range}</td>
                  <td className="py-2.5 px-4 text-right text-emerald-400 font-bold">+{row.mayor} pts</td>
                  <td className="py-2.5 px-4 text-right text-red-400 font-bold">+{row.menor} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}