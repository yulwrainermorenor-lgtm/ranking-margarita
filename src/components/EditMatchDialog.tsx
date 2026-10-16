import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Match, Player } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  match: Match | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMatchDialog({ match, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [winnerSets, setWinnerSets] = useState(3);
  const [loserSets, setLoserSets] = useState(0);
  const [playedAt, setPlayedAt] = useState("");
  const [winnerId, setWinnerId] = useState<string>("");
  const [loserId, setLoserId] = useState<string>("");

  const { data: players } = useQuery({
    queryKey: ["players-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Pick<Player, "id" | "name">[];
    },
  });

  useEffect(() => {
    if (open && match) {
      setWinnerSets(match.winner_sets);
      setLoserSets(match.loser_sets);
      setPlayedAt(match.played_at);
      setWinnerId(match.winner_id);
      setLoserId(match.loser_id);
    }
  }, [open, match]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!match) throw new Error("Sin partido");
      const { data, error } = await supabase.functions.invoke("edit-match", {
        body: {
          match_id: match.id,
          winner_id: winnerId,
          loser_id: loserId,
          winner_sets: winnerSets,
          loser_sets: loserSets,
          played_at: playedAt,
        },
      });
      if (error) throw error;
      if (data?.error) {
        throw new Error(typeof data.error === "string" ? data.error : "Error");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Partido actualizado");
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["player-matches"] });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit =
    winnerSets > loserSets &&
    !!playedAt &&
    !!winnerId &&
    !!loserId &&
    winnerId !== loserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar partido</DialogTitle>
          <DialogDescription>
            Podés corregir jugadores, sets y fecha. Si cambiás los jugadores,
            los puntos del partido se trasladan automáticamente a los nuevos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ganador</Label>
            <Select value={winnerId} onValueChange={setWinnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí jugador" />
              </SelectTrigger>
              <SelectContent>
                {(players ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Perdedor</Label>
            <Select value={loserId} onValueChange={setLoserId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí jugador" />
              </SelectTrigger>
              <SelectContent>
                {(players ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ews">Sets ganador</Label>
              <Input
                id="ews"
                type="number"
                min={0}
                max={7}
                value={winnerSets}
                onChange={(e) => setWinnerSets(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="els">Sets perdedor</Label>
              <Input
                id="els"
                type="number"
                min={0}
                max={7}
                value={loserSets}
                onChange={(e) => setLoserSets(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edate">Fecha</Label>
            <Input
              id="edate"
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}