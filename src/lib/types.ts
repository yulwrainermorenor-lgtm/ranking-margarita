export type Player = {
  id: string;
  name: string;
  club: string | null;
  score: number;
  initial_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Match = {
  id: string;
  played_at: string;
  winner_id: string;
  loser_id: string;
  winner_sets: number;
  loser_sets: number;
  winner_score_before: number;
  loser_score_before: number;
  winner_score_after: number;
  loser_score_after: number;
  points_exchanged: number;
  created_at: string;
};

export type MatchWithPlayers = Match & {
  winner: Pick<Player, "id" | "name"> | null;
  loser: Pick<Player, "id" | "name"> | null;
};

export type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "groups_elimination";

export type TournamentStatus = "draft" | "in_progress" | "finished";

export type TournamentPhase =
  | "group"
  | "upper"
  | "lower"
  | "final"
  | "main"
  | "third_place";

export type Tournament = {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  start_date: string | null;
  end_date: string | null;
  winner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TournamentParticipant = {
  id: string;
  tournament_id: string;
  player_id: string;
  seed: number | null;
  group_label: string | null;
  eliminated: boolean;
  created_at: string;
};

export type TournamentMatch = {
  id: string;
  tournament_id: string;
  phase: TournamentPhase;
  group_label: string | null;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  player1_sets: number | null;
  player2_sets: number | null;
  match_id: string | null;
  next_match_id: string | null;
  next_match_slot: number | null;
  next_match_loser_id: string | null;
  played_at: string | null;
  created_at: string;
  updated_at: string;
};
