import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Tournament } from "@/lib/types";
import type { TournamentMatch } from "@/lib/types";
import type { Player } from "@/lib/types";

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

      if (tournament.format === "single_elimination") {
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

export default RecordTournamentMatchDialog;
