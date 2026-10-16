import { Button } from "@/components/ui/button";
import { Row } from "./Row";
import type { TournamentMatch } from "@/lib/types";
import type { Player } from "@/lib/types";

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

export default MatchCard;
