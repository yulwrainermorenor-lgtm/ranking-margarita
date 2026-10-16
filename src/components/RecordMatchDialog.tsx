import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Check, ChevronsUpDown, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RecordMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWinnerId?: string;
}

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
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal bg-zinc-900 border-white/10 text-white hover:bg-zinc-800"
        >
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
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-red-500",
                      value === p.id ? "opacity-100" : "opacity-0",
                    )}
                  />
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

export function RecordMatchDialog({ open, onOpenChange, defaultWinnerId }: RecordMatchDialogProps) {
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const [winnerId, setWinnerId] = useState<string | undefined>(defaultWinnerId);
  const [loserId, setLoserId] = useState<string | undefined>();
  const [winnerSets, setWinnerSets] = useState(3);
  const [loserSets, setLoserSets] = useState(0);
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setWinnerId(defaultWinnerId);
      setLoserId(undefined);
      setWinnerSets(3);
      setLoserSets(0);
      setPlayedAt(new Date().toISOString().slice(0, 10));
    }
  }, [open, defaultWinnerId]);

  const mutation = useMutation({
    mutationFn: async () => {
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
      return data;
    },
    onSuccess: (data) => {
      const delta = data?.delta ?? data?.match?.points_exchanged ?? 0;
      toast.success(`Partido registrado · ±${delta} pts intercambiados`);
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["player-matches"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = winnerId && loserId && winnerSets > loserSets;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-bold text-lg">
            <Swords className="h-5 w-5 text-red-500" /> Cargar Partido Oficial
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            El puntaje Elo se calcula automáticamente según la Tabla del Reglamento Art. 22.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-zinc-400">Atleta Ganador</Label>
            <PlayerSelect
              players={players}
              value={winnerId}
              onChange={setWinnerId}
              placeholder="Seleccionar atleta ganador"
              excludeId={loserId}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-zinc-400">Atleta Perdedor</Label>
            <PlayerSelect
              players={players}
              value={loserId}
              onChange={setLoserId}
              placeholder="Seleccionar atleta perdedor"
              excludeId={winnerId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ws" className="text-xs font-bold uppercase text-zinc-400">Sets Ganador</Label>
              <Input
                id="ws"
                type="number"
                min={0}
                max={7}
                value={winnerSets}
                onChange={(e) => setWinnerSets(Number(e.target.value))}
                className="bg-zinc-900 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls" className="text-xs font-bold uppercase text-zinc-400">Sets Perdedor</Label>
              <Input
                id="ls"
                type="number"
                min={0}
                max={7}
                value={loserSets}
                onChange={(e) => setLoserSets(Number(e.target.value))}
                className="bg-zinc-900 border-white/10 text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs font-bold uppercase text-zinc-400">Fecha del Partido</Label>
            <Input
              id="date"
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="bg-zinc-900 border-white/10 text-white"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="bg-red-600 hover:bg-red-500 text-white font-bold shadow-glow-red"
          >
            {mutation.isPending ? "Guardando..." : "Registrar Resultado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
