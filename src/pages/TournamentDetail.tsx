import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Player,
  Tournament,
  TournamentMatch,
  TournamentParticipant,
} from "@/lib/types";
import {
  buildBracket,
  drawGroupsByRanking,
  drawGroupsSnake,
  FORMAT_LABEL,
  STATUS_LABEL,
  seedOrder,
  nextPow2,
} from "@/lib/bracket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Play, Trophy, Shuffle, Plus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function PlayerSelect({
  players,
  value,
  onChange,
  placeholder,
}: {
  players: Player[];
  value: string | undefined;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = players.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">{selected.name}</span>
          ) : (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar jugador…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {players.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === p.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.score}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function TournamentDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: tournament } = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Tournament;
    },
    enabled: !!id,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["tournament-participants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_participants")
        .select("*")
        .eq("tournament_id", id!)
        .order("seed", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as TournamentParticipant[];
    },
    enabled: !!id,
  });

  const { data: tmatches = [] } = useQuery({
    queryKey: ["tournament-matches", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", id!)
        .order("round")
        .order("match_number");
      if (error) throw error;
      return data as TournamentMatch[];
    },
    enabled: !!id,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("score", { ascending: false });
      if (error) throw error;
      return data as Player[];
    },
  });

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  if (!tournament) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const hasBracket = tmatches.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/torneos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
            {tournament.name}
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{FORMAT_LABEL[tournament.format]}</Badge>
            <Badge
              variant={
                tournament.status === "in_progress"
                  ? "default"
                  : tournament.status === "finished"
                    ? "secondary"
                    : "outline"
              }
            >
              {STATUS_LABEL[tournament.status]}
            </Badge>
            {tournament.start_date && <span>{tournament.start_date}</span>}
          </div>
        </div>
      </div>

      <Tabs defaultValue={hasBracket ? "bracket" : "participants"}>
        <TabsList>
          <TabsTrigger value="participants">Jugadores ({participants.length})</TabsTrigger>
          <TabsTrigger value="bracket">Cuadro</TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="mt-4">
          <ParticipantsTab
            tournament={tournament}
            participants={participants}
            players={players}
            isAdmin={isAdmin}
            hasBracket={hasBracket}
          />
        </TabsContent>

        <TabsContent value="bracket" className="mt-4">
          <BracketTab
            tournament={tournament}
            participants={participants}
            tmatches={tmatches}
            playerMap={playerMap}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
      qc.invalidateQueries({ queryKey: ["tournament-participants", tournament.id] });
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
      qc.invalidateQueries({ queryKey: ["tournament-participants", tournament.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ idx, dir }: { idx: number; dir: -1 | 1 }) => {
      const next = idx + dir;
      if (next < 0 || next >= ordered.length) return;
      const a = ordered[idx];
      const b = ordered[next];
      // swap seeds
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
      qc.invalidateQueries({ queryKey: ["tournament-participants", tournament.id] }),
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

      // Insert all matches without next_match_id first, capture ids in order
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

      // Now patch next_match_id / next_match_loser_id / next_match_slot
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

      // Update tournament status
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
                            <span className="flex-1 truncate">{pl?.name ?? "—"}</span>
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

  // Group matches: groups, upper, lower, final, main
  const groupMatches = tmatches.filter((m) => m.phase === "group");
  const upperMatches = tmatches.filter((m) => m.phase === "upper");
  const lowerMatches = tmatches.filter((m) => m.phase === "lower");
  const finalMatches = tmatches.filter((m) => m.phase === "final");
  const mainMatches = tmatches.filter((m) => m.phase === "main");
  const thirdMatches = tmatches.filter((m) => m.phase === "third_place");

  // KO seeding from groups
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

  // Manual seeding is allowed whenever the first KO round still has any match
  // without a recorded winner — admin can override pairings any time before play.
  const firstRoundUnplayed = firstKoMatches.filter((m) => !m.winner_id);
  const canManualSeed = isAdmin && firstRoundUnplayed.length > 0;

  // Pool of players that can be placed in the bracket
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

  // Initialize manual slots from current first-round assignments when entering manual mode
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

        // Auto-advance byes
        if (m.next_match_id && m.next_match_slot) {
          const upd: { player1_id?: string | null; player2_id?: string | null } = {};
          if (p1 && !p2) {
            upd[m.next_match_slot === 1 ? "player1_id" : "player2_id"] = p1;
          } else if (!p1 && p2) {
            upd[m.next_match_slot === 1 ? "player1_id" : "player2_id"] = p2;
          } else {
            // clear advancement if both empty or both present (waits for result)
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

  const seedKo = useMutation({
    mutationFn: async () => {
      // Compute standings per group
      const labels = Array.from(
        new Set(groupMatches.map((m) => m.group_label || "")),
      ).sort();
      const standings: Record<string, string[]> = {};
      for (const gl of labels) {
        const gms = groupMatches.filter((m) => m.group_label === gl);
        const stats = new Map<
          string,
          { wins: number; setDiff: number }
        >();
        const ensure = (id: string) => {
          if (!stats.has(id)) stats.set(id, { wins: 0, setDiff: 0 });
          return stats.get(id)!;
        };
        for (const m of gms) {
          if (!m.player1_id || !m.player2_id) continue;
          const s1 = m.player1_sets ?? 0;
          const s2 = m.player2_sets ?? 0;
          const a = ensure(m.player1_id);
          const b = ensure(m.player2_id);
          a.setDiff += s1 - s2;
          b.setDiff += s2 - s1;
          if (m.winner_id === m.player1_id) a.wins++;
          else if (m.winner_id === m.player2_id) b.wins++;
        }
        const ranked = [...stats.entries()]
          .sort((x, y) => {
            if (y[1].wins !== x[1].wins) return y[1].wins - x[1].wins;
            return y[1].setDiff - x[1].setDiff;
          })
          .map(([id]) => id);
        standings[gl] = ranked;
      }

      // qualifiers per group = firstKoMatches*2 / groups
      const totalSlots = firstKoMatches.length * 2;
      const perGroup = Math.max(1, Math.floor(totalSlots / labels.length));
      // Order: position 1 of each group, then position 2 of each group, etc.
      const qualifiers: (string | null)[] = [];
      for (let pos = 0; pos < perGroup; pos++) {
        for (const gl of labels) {
          qualifiers.push(standings[gl]?.[pos] ?? null);
        }
      }
      while (qualifiers.length < totalSlots) qualifiers.push(null);

      // Map to bracket slots via seedOrder
      const size = nextPow2(totalSlots);
      const order = seedOrder(size);
      const slotPlayers: (string | null)[] = order.map(
        (seed) => qualifiers[seed - 1] ?? null,
      );

      // Assign pairs to firstKoMatches in order
      for (let i = 0; i < firstKoMatches.length; i++) {
        const m = firstKoMatches[i];
        const p1 = slotPlayers[i * 2] ?? null;
        const p2 = slotPlayers[i * 2 + 1] ?? null;
        const { error } = await supabase
          .from("tournament_matches")
          .update({ player1_id: p1, player2_id: p2 })
          .eq("id", m.id);
        if (error) throw error;

        // Auto-advance byes
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
      <div className="space-y-3">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Fase de grupos
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {labels.map((gl) => (
            <Card key={gl} className="p-3 space-y-2">
              <div className="font-semibold text-sm">Grupo {gl}</div>
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
                            // If this player was assigned elsewhere, remove from that slot
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

function MatchCard({
  match,
  playerMap,
  onEdit,
  isAdmin,
}: {
  match: TournamentMatch;
  playerMap: Map<string, Player>;
  onEdit: () => void;
  isAdmin: boolean;
}) {
  const p1 = match.player1_id ? playerMap.get(match.player1_id) : null;
  const p2 = match.player2_id ? playerMap.get(match.player2_id) : null;
  const played = !!match.winner_id;
  const canEdit = isAdmin && p1 && p2;

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={!canEdit}
      className="w-full text-left rounded-md border border-border bg-card p-2 hover:border-primary/50 transition-colors disabled:opacity-60 disabled:cursor-default"
    >
      <Row
        name={p1?.name ?? "—"}
        sets={match.player1_sets ?? 0}
        winner={played && match.winner_id === match.player1_id}
      />
      <div className="my-1 h-px bg-border" />
      <Row
        name={p2?.name ?? "—"}
        sets={match.player2_sets ?? 0}
        winner={played && match.winner_id === match.player2_id}
      />
      {played && isAdmin && (
        <div className="mt-1 text-[10px] text-muted-foreground text-right">
          Tocá para editar
        </div>
      )}
    </button>
  );
}

function Row({ name, sets, winner }: { name: string; sets: number; winner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={
          winner ? "font-semibold truncate" : "truncate text-muted-foreground"
        }
      >
        {name}
      </span>
      <span className="tabular-nums text-sm">{sets}</span>
    </div>
  );
}

function Podium({
  tmatches,
  playerMap,
}: {
  tmatches: TournamentMatch[];
  playerMap: Map<string, Player>;
}) {
  // Championship = KO final (no next_match_id, not group/third_place).
  // Pick the highest-round such match to avoid grabbing group matches.
  const finalCandidates = tmatches.filter(
    (m) =>
      !m.next_match_id &&
      m.phase !== "third_place" &&
      m.phase !== "group",
  );
  const championship = finalCandidates.length
    ? finalCandidates.reduce((a, b) => (b.round > a.round ? b : a))
    : undefined;
  const thirdMatch = tmatches.find((m) => m.phase === "third_place");
  const gold = championship?.winner_id ?? null;
  const silver = championship?.loser_id ?? null;
  const bronze = thirdMatch?.winner_id ?? null;

  if (!gold && !silver && !bronze) return null;

  const Step = ({
    place,
    id,
    medal,
    heightClass,
    bgClass,
  }: {
    place: string;
    id: string | null;
    medal: string;
    heightClass: string;
    bgClass: string;
  }) => (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className="text-2xl">{medal}</div>
      <div className="text-xs font-medium truncate max-w-full text-center px-1">
        {id ? (playerMap.get(id)?.name ?? "—") : "—"}
      </div>
      <div
        className={`w-full rounded-t-md ${heightClass} ${bgClass} flex items-center justify-center`}
      >
        <span className="font-bold text-sm">{place}</span>
      </div>
    </div>
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Podio
        </h3>
      </div>
      <div className="flex items-end gap-2">
        <Step
          place="2°"
          id={silver}
          medal="🥈"
          heightClass="h-16"
          bgClass="bg-muted"
        />
        <Step
          place="1°"
          id={gold}
          medal="🥇"
          heightClass="h-24"
          bgClass="bg-primary/30"
        />
        <Step
          place="3°"
          id={bronze}
          medal="🥉"
          heightClass="h-12"
          bgClass="bg-muted/70"
        />
      </div>
    </Card>
  );
}

function RecordTournamentMatchDialog({
  match,
  playerMap,
  tournament,
  onClose,
}: {
  match: TournamentMatch | null;
  playerMap: Map<string, Player>;
  tournament: Tournament;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [winnerSlot, setWinnerSlot] = useState<1 | 2>(1);
  const [winnerSets, setWinnerSets] = useState(3);
  const [loserSets, setLoserSets] = useState(0);

  const open = !!match;
  const p1 = match?.player1_id ? playerMap.get(match.player1_id) : null;
  const p2 = match?.player2_id ? playerMap.get(match.player2_id) : null;
  const isEdit = !!match?.winner_id;

  // Pre-fill when opening
  useEffect(() => {
    if (!match) return;
    if (match.winner_id) {
      const slot: 1 | 2 = match.winner_id === match.player1_id ? 1 : 2;
      setWinnerSlot(slot);
      const wSets =
        slot === 1 ? (match.player1_sets ?? 0) : (match.player2_sets ?? 0);
      const lSets =
        slot === 1 ? (match.player2_sets ?? 0) : (match.player1_sets ?? 0);
      setWinnerSets(wSets);
      setLoserSets(lSets);
    } else {
      setWinnerSlot(1);
      setWinnerSets(3);
      setLoserSets(0);
    }
  }, [match]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!match || !p1 || !p2) throw new Error("Faltan jugadores");
      if (winnerSets <= loserSets) throw new Error("El ganador debe tener más sets");

      const winner = winnerSlot === 1 ? p1 : p2;
      const loser = winnerSlot === 1 ? p2 : p1;

      const previousWinnerId = match.winner_id;
      const playedAt =
        match.played_at ?? new Date().toISOString().slice(0, 10);

      let mainMatchId = match.match_id ?? null;

      if (isEdit && mainMatchId) {
        // Edit existing main-ranking match (recalculates points)
        const { data: ed, error: edErr } = await supabase.functions.invoke(
          "edit-match",
          {
            body: {
              match_id: mainMatchId,
              winner_id: winner.id,
              loser_id: loser.id,
              winner_sets: winnerSets,
              loser_sets: loserSets,
              played_at: playedAt,
            },
          },
        );
        if (edErr) throw edErr;
        if (ed?.error) throw new Error(String(ed.error));
      } else {
        // Record new match in main ranking
        const { data: rec, error: recErr } = await supabase.functions.invoke(
          "record-match",
          {
            body: {
              winner_id: winner.id,
              loser_id: loser.id,
              winner_sets: winnerSets,
              loser_sets: loserSets,
              played_at: playedAt,
            },
          },
        );
        if (recErr) throw recErr;
        if (rec?.error) throw new Error(String(rec.error));
        mainMatchId = rec?.match_id ?? null;
      }

      // Update tournament_match
      const { error: tmErr } = await supabase
        .from("tournament_matches")
        .update({
          winner_id: winner.id,
          loser_id: loser.id,
          player1_sets: winnerSlot === 1 ? winnerSets : loserSets,
          player2_sets: winnerSlot === 1 ? loserSets : winnerSets,
          match_id: mainMatchId,
          played_at: playedAt,
        })
        .eq("id", match.id);
      if (tmErr) throw tmErr;

      // Advance/replace winner in next match
      if (match.next_match_id && match.next_match_slot) {
        const update =
          match.next_match_slot === 1
            ? { player1_id: winner.id }
            : { player2_id: winner.id };
        const { error: nErr } = await supabase
          .from("tournament_matches")
          .update(update)
          .eq("id", match.next_match_id);
        if (nErr) throw nErr;
      }

      // Route loser into a 3rd-place / consolation match if linked
      if (match.next_match_loser_id) {
        const { data: target } = await supabase
          .from("tournament_matches")
          .select("player1_id, player2_id")
          .eq("id", match.next_match_loser_id)
          .single();
        const prevLoserId = isEdit
          ? match.player1_id === previousWinnerId
            ? match.player2_id
            : match.player1_id
          : null;
        const upd: { player1_id?: string | null; player2_id?: string | null } = {};
        if (target?.player1_id && prevLoserId && target.player1_id === prevLoserId) {
          upd.player1_id = loser.id;
        } else if (target?.player2_id && prevLoserId && target.player2_id === prevLoserId) {
          upd.player2_id = loser.id;
        } else if (!target?.player1_id) {
          upd.player1_id = loser.id;
        } else if (!target?.player2_id) {
          upd.player2_id = loser.id;
        } else {
          upd.player1_id = loser.id;
        }
        await supabase
          .from("tournament_matches")
          .update(upd)
          .eq("id", match.next_match_loser_id);
      }

      // Loser eliminated bookkeeping (single elim)
      if (tournament.format === "single_elimination") {
        // un-eliminate old loser if winner changed
        if (isEdit && previousWinnerId && previousWinnerId === loser.id) {
          await supabase
            .from("tournament_participants")
            .update({ eliminated: false })
            .eq("tournament_id", tournament.id)
            .eq("player_id", previousWinnerId);
        }
        await supabase
          .from("tournament_participants")
          .update({ eliminated: true })
          .eq("tournament_id", tournament.id)
          .eq("player_id", loser.id);
      }

      // Final match → set tournament winner (skip 3rd-place match)
      if (!match.next_match_id && match.phase !== "third_place") {
        await supabase
          .from("tournaments")
          .update({
            status: "finished",
            winner_id: winner.id,
            end_date: new Date().toISOString().slice(0, 10),
          })
          .eq("id", tournament.id);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Resultado actualizado" : "Resultado registrado");
      qc.invalidateQueries({ queryKey: ["tournament-matches", tournament.id] });
      qc.invalidateQueries({ queryKey: ["tournament-participants", tournament.id] });
      qc.invalidateQueries({ queryKey: ["tournament", tournament.id] });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar resultado" : "Cargar resultado"}</DialogTitle>
        </DialogHeader>
        {match && p1 && p2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ganador</Label>
              <Select
                value={String(winnerSlot)}
                onValueChange={(v) => setWinnerSlot(Number(v) as 1 | 2)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{p1.name}</SelectItem>
                  <SelectItem value="2">{p2.name}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sets ganador</Label>
                <Input
                  type="number"
                  min={0}
                  max={7}
                  value={winnerSets}
                  onChange={(e) => setWinnerSets(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sets perdedor</Label>
                <Input
                  type="number"
                  min={0}
                  max={7}
                  value={loserSets}
                  onChange={(e) => setLoserSets(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "Guardando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}