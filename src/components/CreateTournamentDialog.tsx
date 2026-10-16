import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TournamentFormat } from "@/lib/types";
import { FORMAT_LABEL } from "@/lib/bracket";
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
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreateTournamentDialog({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("single_elimination");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .insert({ name: name.trim(), format, start_date: startDate, status: "draft" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Torneo creado");
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      onOpenChange(false);
      setName("");
      setFormat("single_elimination");
      onCreated?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo torneo</DialogTitle>
          <DialogDescription>Configurá el formato y agregá jugadores luego.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tname">Nombre</Label>
            <Input
              id="tname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Copa Verano 2026"
            />
          </div>
          <div className="space-y-2">
            <Label>Formato</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as TournamentFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_elimination">{FORMAT_LABEL.single_elimination}</SelectItem>
                <SelectItem value="double_elimination">{FORMAT_LABEL.double_elimination}</SelectItem>
                <SelectItem value="groups_elimination">{FORMAT_LABEL.groups_elimination}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tdate">Fecha de inicio</Label>
            <Input
              id="tdate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creando…" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}