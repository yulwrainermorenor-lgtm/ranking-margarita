import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPlayerDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [score, setScore] = useState<number>(1894);

  useEffect(() => {
    if (open) {
      setName("");
      setClub("");
      setScore(1894);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Nombre requerido");
      const { error } = await supabase.from("players").insert({
        name: trimmedName,
        club: club.trim() || null,
        score,
      });
      if (error) throw error;
      supabase.functions.invoke("sync-sheets").catch((e) =>
        console.error("sync-sheets dispatch failed:", e),
      );
    },
    onSuccess: () => {
      toast.success("Jugador agregado");
      qc.invalidateQueries({ queryKey: ["players"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = name.trim().length > 0 && Number.isFinite(score);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo jugador</DialogTitle>
          <DialogDescription>
            Agregá un participante al ranking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="club">Club (opcional)</Label>
            <Input
              id="club"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Club"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="score">Puntaje inicial</Label>
            <Input
              id="score"
              type="number"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
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
            {mutation.isPending ? "Guardando..." : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
