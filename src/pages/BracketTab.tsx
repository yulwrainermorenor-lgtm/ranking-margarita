import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tournament,
  TournamentMatch,
  TournamentParticipant,
  Player,
} from "@/lib/types";
import { computeGroupStandings, getQualifiersForKnockout } from "@/lib/groupStandings";
import { seedOrder, nextPow2 } from "@/lib/bracket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Play, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import MatchCard from "./MatchCard";
import Podium from "./Podium";
import RecordTournamentMatchDialog from "./RecordTournamentMatchDialog";

function BracketTab({
  tournament,
  participants,
  tmatches,
  playerMap,
  isAdmin,
}: {
  tournament: Tournament;
  participants: TournamentParticipant[];
  tmatches: TournamentMatch[];
  playerMap: Map<string, Player>;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState<TournamentMatch | null>(null);
  const [manualSeed, setManualSeed] = useState(false);
  const [manualSlots, setManualSlots] = useState<Record<string, (string | null)[]>>({});
  const qc = useQueryClient();

  const deleteBracket = useMutation({
    mutationFn: async () => {
      const { error: dErr } = await supabase
        .from("tournament_matches")
        .delete()
        .eq("tournament_id", tournament.id);
      if (dErr) throw dErr;
      const { error: pErr } = await supabase
        .from("tournament_participants")
        .update({ eliminated: false })
        .eq("tournament_id", tournament.id);
      if (pErr) throw pErr;
      const { error: tErr } = await supabase
        .from("tournaments")
        .update({ status: "draft", winner_id: null, end_date: null })
        .eq("id", tournament.id);
      if (tErr) throw tErr;
    },
    onSuccess: () => {
      toast.success("Cuadro eliminado");
      qc.invalidateQueries({ queryKey: ["tournament-matches", tournament.id] });
      qc.invalidateQueries({ queryKey: ["tournament-participants", tournament.id] });
      qc.invalidateQueries({ queryKey: ["tournament", tournament.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (tmatches.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Aún no se generó el cuadro. Andá a la pestaña Jugadores.
      </Card>
    );
  }

  const groupMatches = tmatches.filter((m) => m.phase === "group");
  const upperMatches = tmatches.filter((m) => m.phase === "upper");
  const lowerMatches = tmatches.filter((m) => m.phase === "lower");
  const finalMatches = tmatches.filter((m) => m.phase === "final");
  const mainMatches = tmatches.filter((m) => m.phase === "main");
  const thirdMatches = tmatches.filter((m) => m.phase === "third_place");

  const groupsDone =
    groupMatches.length > 0 && groupMatches.every((m) => !!m.winner_id);
  const firstKoRound =
    mainMatches.length > 0 ? Math.min(...mainMatches.map((m) => m.round)) : null;
  const firstKoMatches =
    firstKoRound != null
      ? mainMatches
          .filter((m) => m.round === firstKoRound)
          .sort((a, b) => a.match_number - b.match_number)
      : [];
  const koEmpty =
    firstKoMatches.length > 0 &&
    firstKoMatches.every((m) => !m.player1_id && !m.player2_id);
  const canSeedKo = isAdmin && groupsDone && koEmpty;

  const firstRoundUnplayed = firstKoMatches.filter((m) => !m.winner_id);
  const canManualSeed = isAdmin && firstRoundUnplayed.length > 0;

  const eligiblePool: string[] = (() => {
    if (groupMatches.length > 0) {
      const ids = new Set<string>();
      for (const m of groupMatches) {
        if (m.player1_id) ids.add(m.player1_id);
        if (m.player2_id) ids.add(m.player2_id);
      }
      return [...ids];
    }
    return participants.map((p) => p.player_id);
  })();

  useEffect(() => {
    if (!manualSeed) return;
    const init: Record<string, (string | null)[]> = {};
    for (const m of firstKoMatches) {
      init[m.id] = [m.player1_id ?? null, m.player2_id ?? null];
    }
    setManualSlots(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualSeed, tmatches.length]);

  const usedInManual = new Set(
    Object.values(manualSlots).flat().filter((x): x is string => !!x),
  );

  const saveManual = useMutation({
    mutationFn: async () => {
      for (const m of firstKoMatches) {
        const slots = manualSlots[m.id] ?? [null, null];
        const p1 = slots[0];
        const p2 = slots[1];
        const { error } = await supabase
          .from("tournament_matches")
          .update({ player1_id: p1, player2_id: p2 })
          .eq("id", m.id);
        if (error) throw error;

        if (m.next_match_id && m.next_match_slot) {
          const upd: { player1_id?: string | null; player2_id?: string | null } = {};
          if (p1 && !p2) {
            upd[m.next_match_slot === 1 ? "player1_id" : "player2_id"] = p1;
          } else if (!p1 && p2) {
            upd[m.next_match_slot === 1 ? "player1_id" : "player2_id"] = p2;
          } else {
            upd[m.next_match_slot === 1 ? "player1_id" : "player2_id"] = null;
          }
          await supabase
            .from("tournament_matches")
            .update(upd)
            .eq("id", m.next_match_id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Emparejamientos guardados");
      setManualSeed(false);
      qc.invalidateQueries({ queryKey: ["tournament-matches", tournament.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const playerScores = useMemo(() => {
    const m = new Map<string, number>();
    playerMap.forEach((p, id) => m.set(id, p.score));
    return m;
  }, [playerMap]);

  const groupStandings = useMemo(
    () => computeGroupStandings(groupMatches, playerScores),
    [groupMatches, playerScores],
  );

  const seedKo = useMutation({
    mutationFn: async () => {
      const totalSlots = firstKoMatches.length * 2;
      const labels = groupStandings.map((g) => g.label);
      const perGroup = Math.max(1, Math.floor(totalSlots / labels.length));
      const qualifiers = getQualifiersForKnockout(groupStandings, perGroup);

      const paddedQualifiers: (string | null)[] = [...qualifiers];
      while (paddedQualifiers.length < totalSlots) paddedQualifiers.push(null);

      const size = nextPow2(totalSlots);
      const order = seedOrder(size);
      const slotPlayers: (string | null)[] = order.map(
        (seed) => paddedQualifiers[seed - 1] ?? null,
      );

      for (let i = 0; i < firstKoMatches.length; i++) {
        const m = firstKoMatches[i];
        const p1 = slotPlayers[i * 2] ?? null;
        const p2 = slotPlayers[i * 2 + 1] ?? null;
        const { error } = await supabase
          .from("tournament_matches")
          .update({ player1_id: p1, player2_id: p2 })
          .eq("id", m.id);
        if (error) throw error;

        if (m.next_match_id && m.next_match_slot) {
          if (p1 && !p2) {
            const upd =
              m.next_match_slot === 1
                ? { player1_id: p1 }
                : { player2_id: p1 };
            await supabase
              .from("tournament_matches")
              .update(upd)
              .eq("id", m.next_match_id);
          } else if (!p1 && p2) {
            const upd =
              m.next_match_slot === 1
                ? { player1_id: p2 }
                : { player2_id: p2 };
            await supabase
              .from("tournament_matches")
              .update(upd)
              .eq("id", m.next_match_id);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Fase eliminatoria sembrada");
      qc.invalidateQueries({
        queryKey: ["tournament-matches", tournament.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderRoundsBlock = (label: string, matches: TournamentMatch[]) => {
    if (matches.length === 0) return null;
    const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          {label}
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {rounds.map((r) => (
            <div key={r} className="flex flex-col gap-2 min-w-[220px]">
              <div className="text-xs text-muted-foreground">Ronda {r}</div>
              {matches
                .filter((m) => m.round === r)
                .map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    playerMap={playerMap}
                    onEdit={() => isAdmin && setEditing(m)}
                    isAdmin={isAdmin}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGroups = () => {
    if (groupMatches.length === 0) return null;
    const labels = Array.from(new Set(groupMatches.map((m) => m.group_label || "")));
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Fase de grupos
        </h3>

        {groupStandings.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {groupStandings.map((gs) => (
              <Card key={`standings-${gs.label}`} className="p-3 space-y-2">
                <div className="font-semibold text-sm flex items-center gap-2">
                  Grupo {gs.label}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Tabla de posiciones
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-1 pr-1 w-6">#</th>
                        <th className="text-left py-1 pr-2">Jugador</th>
                        <th className="text-center py-1 px-1">V</th>
                        <th className="text-center py-1 px-1">D</th>
                        <th className="text-center py-1 px-1" title="Sets ganados - perdidos">Sets</th>
                        <th className="text-center py-1 px-1" title="Ratio de sets">Ratio</th>
                        <th className="text-left py-1 pl-1">Desempate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gs.standings.map((s) => {
                        const player = playerMap.get(s.playerId);
                        return (
                          <tr
                            key={s.playerId}
                            className={cn(
                              "border-b border-border/50 last:border-0",
                              s.position <= 2 && "bg-emerald-500/5",
                            )}
                          >
                            <td className="py-1.5 pr-1 font-mono font-bold text-muted-foreground">
                              {s.position}
                            </td>
                            <td className="py-1.5 pr-2 font-medium truncate max-w-[140px]">
                              {player?.name ?? s.playerId}
                            </td>
                            <td className="text-center py-1.5 px-1 font-mono text-emerald-400">
                              {s.wins}
                            </td>
                            <td className="text-center py-1.5 px-1 font-mono text-red-400">
                              {s.losses}
                            </td>
                            <td className="text-center py-1.5 px-1 font-mono">
                              <span className="text-emerald-300">{s.setsWon}</span>
                              <span className="text-muted-foreground">-</span>
                              <span className="text-red-300">{s.setsLost}</span>
                            </td>
                            <td className="text-center py-1.5 px-1 font-mono">
                              {s.setsRatio === Infinity
                                ? "∞"
                                : s.setsRatio === 0
                                  ? "0"
                                  : s.setsRatio.toFixed(2)}
                            </td>
                            <td className="py-1.5 pl-1 text-[10px] text-muted-foreground italic">
                              {s.tiebreakNote}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {labels.map((gl) => (
            <Card key={gl} className="p-3 space-y-2">
              <div className="font-semibold text-sm">Grupo {gl} — Partidos</div>
              {groupMatches
                .filter((m) => m.group_label === gl)
                .map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    playerMap={playerMap}
                    onEdit={() => isAdmin && setEditing(m)}
                    isAdmin={isAdmin}
                  />
                ))}
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {isAdmin && tmatches.length > 0 && (
        <Button
          variant="destructive"
          className="w-full gap-1.5"
          disabled={deleteBracket.isPending}
          onClick={() => {
            if (
              confirm(
                "¿Eliminar el cuadro? Los emparejamientos y resultados del torneo se borrarán. Los partidos ya cargados al ranking general se mantienen.",
              )
            ) {
              deleteBracket.mutate();
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
          {deleteBracket.isPending ? "Eliminando…" : "Eliminar cuadro / sorteo"}
        </Button>
      )}
      {renderGroups()}
      {canSeedKo && (
        <Button
          className="w-full gap-1.5"
          onClick={() => seedKo.mutate()}
          disabled={seedKo.isPending}
        >
          <Play className="h-4 w-4" />
          {seedKo.isPending ? "Sembrando…" : "Sembrar fase eliminatoria"}
        </Button>
      )}
      {canManualSeed && (
        <Button
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => setManualSeed((v) => !v)}
        >
          <Shuffle className="h-4 w-4" />
          {manualSeed ? "Cerrar emparejamientos a mano" : "Armar emparejamientos a mano"}
        </Button>
      )}
      {manualSeed && (
        <Card className="p-3 space-y-3">
          <div className="text-xs text-muted-foreground">
            Asigná manualmente los jugadores a cada enfrentamiento de la primera ronda.
            Dejá un slot vacío para crear un BYE (el otro avanza automáticamente).
          </div>
          <div className="space-y-2">
            {firstKoMatches.map((m, idx) => {
              const slots = manualSlots[m.id] ?? [null, null];
              return (
                <div
                  key={m.id}
                  className="rounded-md border border-border p-2 space-y-1.5"
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Partido {idx + 1}
                  </div>
                  {[0, 1].map((slotIdx) => {
                    const current = slots[slotIdx];
                    return (
                      <Select
                        key={slotIdx}
                        value={current ?? "__empty"}
                        onValueChange={(v) => {
                          const next = v === "__empty" ? null : v;
                          setManualSlots((prev) => {
                            const copy = { ...prev };
                            if (next) {
                              for (const mid of Object.keys(copy)) {
                                const arr = [...copy[mid]];
                                for (let i = 0; i < arr.length; i++) {
                                  if (
                                    arr[i] === next &&
                                    !(mid === m.id && i === slotIdx)
                                  ) {
                                    arr[i] = null;
                                  }
                                }
                                copy[mid] = arr;
                              }
                            }
                            const own = [...(copy[m.id] ?? [null, null])];
                            own[slotIdx] = next;
                            copy[m.id] = own;
                            return copy;
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="— Vacío (BYE) —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty">— Vacío (BYE) —</SelectItem>
                          {eligiblePool.map((pid) => {
                            const pl = playerMap.get(pid);
                            const taken = usedInManual.has(pid) && pid !== current;
                            return (
                              <SelectItem
                                key={pid}
                                value={pid}
                                disabled={taken}
                              >
                                {pl?.name ?? pid}
                                {taken ? " (asignado)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setManualSeed(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={saveManual.isPending}
              onClick={() => saveManual.mutate()}
            >
              {saveManual.isPending ? "Guardando…" : "Guardar emparejamientos"}
            </Button>
          </div>
        </Card>
      )}
      {renderRoundsBlock("Cuadro principal", mainMatches)}
      {renderRoundsBlock("Upper bracket", upperMatches)}
      {renderRoundsBlock("Lower bracket", lowerMatches)}
      {renderRoundsBlock("Final", finalMatches)}
      {renderRoundsBlock("Definición 3er puesto", thirdMatches)}

      <Podium tmatches={tmatches} playerMap={playerMap} />

      <RecordTournamentMatchDialog
        match={editing}
        playerMap={playerMap}
        tournament={tournament}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

export default BracketTab;
