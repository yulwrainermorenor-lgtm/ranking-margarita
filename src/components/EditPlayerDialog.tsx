import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Props {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPlayerDialog({ player, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [score, setScore] = useState<number>(0);
  const [initialScore, setInitialScore] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && player) {
      setName(player.name);
      setClub(player.club ?? "");
      setScore(player.score);
      setInitialScore(player.initial_score ?? player.score);
      setIsActive(player.is_active ?? true);
    }
  }, [open, player]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!player) throw new Error("Sin jugador");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nombre requerido");
      const { error } = await supabase
        .from("players")
        .update({
          name: trimmed,
          club: club.trim() || null,
          score,
          initial_score: initialScore,
          is_active: isActive,
        })
        .eq("id", player.id);
      if (error) throw error;
      // Push DB state to Google Sheets so edits are reflected there
      supabase.functions.invoke("sync-sheets").catch((e) =>
        console.error("sync-sheets dispatch failed:", e),
      );
    },
    onSuccess: () => {
      toast.success("Jugador actualizado");
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player", player?.id] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!player) throw new Error("Sin jugador");
      // Block deletion if the player has matches
      const { count, error: cErr } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .or(`winner_id.eq.${player.id},loser_id.eq.${player.id}`);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(
          `No se puede eliminar: el jugador tiene ${count} partido(s) registrados.`,
        );
      }
      const { error } = await supabase.from("players").delete().eq("id", player.id);
      if (error) throw error;
      supabase.functions.invoke("sync-sheets").catch((e) =>
        console.error("sync-sheets dispatch failed:", e),
      );
    },
    onSuccess: () => {
      toast.success("Jugador eliminado");
      qc.invalidateQueries({ queryKey: ["players"] });
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmDelete(false);
    },
  });

  const canSubmit = name.trim().length > 0 && Number.isFinite(score);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar jugador</DialogTitle>
            <DialogDescription>
              Modificá los datos del participante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-club">Club</Label>
              <Input
                id="edit-club"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                placeholder="Club (opcional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-score">Puntaje</Label>
              <Input
                id="edit-score"
                type="number"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-initial-score">Puntos iniciales</Label>
              <Input
                id="edit-initial-score"
                type="number"
                value={initialScore}
                onChange={(e) => setInitialScore(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Puntaje base con el que el jugador empezó. Se usa para mostrar la
                evolución en su perfil.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-active" className="text-sm">
                  Participante activo
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isActive
                    ? "Aparece en la lista de activos del Sheet."
                    : "Aparece en la lista de pasivos del Sheet."}
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={updateMutation.isPending || deleteMutation.isPending}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!canSubmit || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
              >
                {updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {player?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Solo se permite si el jugador no
              tiene partidos registrados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
