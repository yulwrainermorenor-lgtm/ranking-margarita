import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Player,
  Tournament,
  TournamentParticipant,
} from "@/lib/types";
import { buildBracket, drawGroupsByRanking, drawGroupsSnake } from "@/lib/bracket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shuffle, Plus, Play, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import PlayerSelect from "./PlayerSelect";

function ParticipantsTab({
  tournament,
  participants,
  players,
  isAdmin,
  hasBracket,
}: {
  tournament: Tournament;
  participants: TournamentParticipant[];
  players: Player[];
  isAdmin: boolean;
  hasBracket: boolean;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");
  const [groupCount, setGroupCount] = useState(4);
  const [qualifyPerGroup, setQualifyPerGroup] = useState(2);
  const [drawnGroups, setDrawnGroups] = useState<string[][] | null>(null);
  const [groupSizes, setGroupSizes] = useState<number[] | null>(null);

  const available = players.filter(
    (p) => !participants.some((pp) => pp.player_id === p.id),
  );

  const ordered = [...participants].sort(
    (a, b) => (a.seed ?? 9999) - (b.seed ?? 9999),
  );

  const add = useMutation({
    mutationFn: async (playerId: string) => {
      const seed = (participants.length || 0) + 1;
      const { error } = await supabase
        .from("tournament_participants")
        .insert({ tournament_id: tournament.id, player_id: playerId, seed });
      if (error) throw error;
    },
    onSuccess: () => {
      setSelected("");
      qc.invalidateQueries({
        queryKey: ["tournament-participants", tournament.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (pid: string) => {
      const { error } = await supabase
        .from("tournament_participants")
        .delete()
        .eq("id", pid);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["tournament-participants", tournament.id],
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ idx, dir }: { idx: number; dir: -1 | 1 }) => {
      const next = idx + dir;
      if (next < 0 || next >= ordered.length) return;
      const a = ordered[idx];
      const b = ordered[next];
      const seedA = a.seed ?? idx + 1;
      const seedB = b.seed ?? next + 1;
      const { error: e1 } = await supabase
        .from("tournament_participants")
        .update({ seed: seedB })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("tournament_participants")
        .update({ seed: seedA })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["tournament-participants", tournament.id],
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (ordered.length < 2) throw new Error("Agregá al menos 2 jugadores");
      const playerIds = ordered.map((p) => p.player_id);
      const built = buildBracket(tournament.format, playerIds, {
        groupCount,
        qualifyPerGroup,
        presetGroups:
          tournament.format === "groups_elimination" && drawnGroups
            ? drawnGroups
            : undefined,
      });

      const inserts = built.map((m) => ({
        tournament_id: tournament.id,
        phase: m.phase,
        group_label: m.group_label,
        round: m.round,
        match_number: m.match_number,
        player1_id: m.player1_id,
        player2_id: m.player2_id,
      }));
      const { data: inserted, error } = await supabase
        .from("tournament_matches")
        .insert(inserts)
        .select("id");
      if (error) throw error;
      const ids = (inserted ?? []).map((r: { id: string }) => r.id);

      for (let i = 0; i < built.length; i++) {
        const m = built[i];
        const needsUpdate =
          m.next_match_idx != null ||
          m.next_match_loser_idx != null ||
          m.next_match_slot != null;
        if (!needsUpdate) continue;
        const { error: ue } = await supabase
          .from("tournament_matches")
          .update({
            next_match_id:
              m.next_match_idx != null ? ids[m.next_match_idx] : null,
            next_match_loser_id:
              m.next_match_loser_idx != null
                ? ids[m.next_match_loser_idx]
                : null,
            next_match_slot: m.next_match_slot ?? null,
          })
          .eq("id", ids[i]);
        if (ue) throw ue;
      }

      const { error: te } = await supabase
        .from("tournaments")
        .update({ status: "in_progress" })
        .eq("id", tournament.id);
      if (te) throw te;
    },
    onSuccess: () => {
      toast.success("Cuadro generado");
      qc.invalidateQueries({ queryKey: ["tournament-matches", tournament.id] });
      qc.invalidateQueries({ queryKey: ["tournament", tournament.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {isAdmin && !hasBracket && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <PlayerSelect
                players={available}
                value={selected || undefined}
                onChange={(id) => setSelected(id)}
                placeholder={
                  available.length === 0
                    ? "No quedan jugadores"
                    : "Buscar jugador para inscribir…"
                }
              />
            </div>
            <Button disabled={!selected} onClick={() => add.mutate(selected)}>
              Agregar
            </Button>
          </div>

          {tournament.format === "groups_elimination" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cantidad de grupos</Label>
                  <Input
                    type="number"
                    min={2}
                    value={groupCount}
                    onChange={(e) => {
                      setGroupCount(Number(e.target.value));
                      setDrawnGroups(null);
                      setGroupSizes(null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Clasifican por grupo</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={qualifyPerGroup}
                    onChange={(e) => setQualifyPerGroup(Number(e.target.value))}
                  />
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full gap-1.5"
                disabled={ordered.length < groupCount}
                onClick={() => {
                  const pool = ordered
                    .map((p) => {
                      const pl = players.find((x) => x.id === p.player_id);
                      return pl ? { id: pl.id, score: pl.score } : null;
                    })
                    .filter((x): x is { id: string; score: number } => !!x);
                  const sizes =
                    groupSizes && groupSizes.length === groupCount
                      ? groupSizes
                      : undefined;
                  const g = drawGroupsByRanking(pool, groupCount, sizes);
                  setDrawnGroups(g);
                  setGroupSizes(g.map((x) => x.length));
                  toast.success("Grupos sorteados");
                }}
              >
                <Shuffle className="h-4 w-4" />
                {drawnGroups ? "Re-sortear grupos" : "Sortear grupos por puntaje"}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-1.5"
                disabled={ordered.length < groupCount}
                onClick={() => {
                  const pool = ordered
                    .map((p) => {
                      const pl = players.find((x) => x.id === p.player_id);
                      return pl ? { id: pl.id, score: pl.score } : null;
                    })
                    .filter((x): x is { id: string; score: number } => !!x);
                  const sizes =
                    groupSizes && groupSizes.length === groupCount
                      ? groupSizes
                      : undefined;
                  const g = drawGroupsSnake(pool, groupCount, sizes);
                  setDrawnGroups(g);
                  setGroupSizes(g.map((x) => x.length));
                  toast.success("Grupos sorteados (serpiente)");
                }}
              >
                <Shuffle className="h-4 w-4" />
                Sortear grupos serpiente
              </Button>

              <Button
                variant="outline"
                className="w-full gap-1.5"
                disabled={ordered.length < 2}
                onClick={() => {
                  const all = ordered.map((p) => p.player_id);
                  const g: string[][] = Array.from(
                    { length: groupCount },
                    (_, i) => (i === 0 ? [...all] : []),
                  );
                  setDrawnGroups(g);
                  setGroupSizes(g.map((x) => x.length));
                  toast.success(
                    "Grupos vacíos creados. Asigná cada jugador a su grupo.",
                  );
                }}
              >
                <Plus className="h-4 w-4" />
                Armar grupos a mano
              </Button>

              {drawnGroups && (
                <div className="rounded-md border p-3 space-y-2">
                  <Label className="text-xs">Jugadores por grupo</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {drawnGroups.map((_, i) => (
                      <div key={i} className="space-y-1">
                        <div className="text-[10px] text-muted-foreground">
                          Grupo {String.fromCharCode(65 + i)}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={groupSizes?.[i] ?? drawnGroups[i].length}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value));
                            setGroupSizes((prev) => {
                              const base =
                                prev && prev.length === drawnGroups.length
                                  ? [...prev]
                                  : drawnGroups.map((g) => g.length);
                              base[i] = v;
                              return base;
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Ajustá los tamaños y volvé a sortear para aplicarlos. Total: {ordered.length} jugador{ordered.length === 1 ? "" : "es"}.
                  </p>
                </div>
              )}

              {drawnGroups && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {drawnGroups.map((g, i) => (
                    <Card key={i} className="p-3 space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Grupo {String.fromCharCode(65 + i)}
                      </div>
                      {g.map((pid) => {
                        const pl = players.find((x) => x.id === pid);
                        return (
                          <div
                            key={pid}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="flex-1 truncate">
                              {pl?.name ?? "—"}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {pl?.score ?? ""}
                            </span>
                            <Select
                              value={String(i)}
                              onValueChange={(v) => {
                                const target = Number(v);
                                if (target === i) return;
                                setDrawnGroups((prev) => {
                                  if (!prev) return prev;
                                  const next = prev.map((arr) => [...arr]);
                                  next[i] = next[i].filter((x) => x !== pid);
                                  next[target] = [...next[target], pid];
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 w-[72px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {drawnGroups.map((_, gi) => (
                                  <SelectItem key={gi} value={String(gi)}>
                                    Grupo {String.fromCharCode(65 + gi)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                      <div className="text-[10px] text-muted-foreground pt-1">
                        {g.length} jugador{g.length === 1 ? "" : "es"}
                      </div>
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    className="h-full min-h-[80px] gap-1.5"
                    onClick={() => {
                      setDrawnGroups((prev) => (prev ? [...prev, []] : null));
                      setGroupCount((c) => c + 1);
                      setGroupSizes((prev) => (prev ? [...prev, 0] : null));
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Añadir grupo
                  </Button>
                </div>
              )}
            </>
          )}

          <Button
            className="w-full gap-1.5"
            disabled={ordered.length < 2 || generate.isPending}
            onClick={() => generate.mutate()}
          >
            <Play className="h-4 w-4" />
            {generate.isPending ? "Generando…" : "Generar cuadro y empezar"}
          </Button>
        </Card>
      )}

      {hasBracket && (
        <Card className="p-3 text-xs text-muted-foreground">
          El cuadro ya fue generado. Para modificar jugadores, eliminá el torneo y creá uno nuevo.
        </Card>
      )}

      <Card className="divide-y divide-border">
        {ordered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Sin jugadores aún.
          </div>
        )}
        {ordered.map((p, idx) => {
          const player = players.find((pl) => pl.id === p.player_id);
          return (
            <div key={p.id} className="flex items-center gap-2 p-3">
              <span className="w-6 text-xs text-muted-foreground tabular-nums">
                #{idx + 1}
              </span>
              <span className="flex-1 truncate font-medium">
                {player?.name ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {player?.score ?? ""}
              </span>
              {isAdmin && !hasBracket && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === 0}
                    onClick={() => move.mutate({ idx, dir: -1 })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === ordered.length - 1}
                    onClick={() => move.mutate({ idx, dir: 1 })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => remove.mutate(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export default ParticipantsTab;
