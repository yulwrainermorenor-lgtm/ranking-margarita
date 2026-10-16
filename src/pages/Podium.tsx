import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import type { TournamentMatch } from "@/lib/types";
import type { Player } from "@/lib/types";

function Podium({
  tmatches,
  playerMap,
}: {
  tmatches: TournamentMatch[];
  playerMap: Map<string, Player>;
}) {
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

export default Podium;
