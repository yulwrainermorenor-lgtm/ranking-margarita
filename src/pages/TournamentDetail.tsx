import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Player,
  Tournament,
  TournamentMatch,
  TournamentParticipant,
} from "@/lib/types";
import { FORMAT_LABEL, STATUS_LABEL } from "@/lib/bracket";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ParticipantsTab from "./ParticipantsTab";
import BracketTab from "./BracketTab";

export default function TournamentDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();

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
          <TabsTrigger value="participants">
            Jugadores ({participants.length})
          </TabsTrigger>
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
