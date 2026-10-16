import initialData from "../data/initialData.json";
import { Player, Match, Tournament, TournamentMatch, TournamentParticipant } from "./types";
import { pointsForMatch } from "./points";

const PLAYERS_KEY = "ranking_margarita_players_v2";
const MATCHES_KEY = "ranking_margarita_matches_v2";
const TOURNAMENTS_KEY = "ranking_margarita_tournaments_v2";
const TOURNAMENT_MATCHES_KEY = "ranking_margarita_tournament_matches_v2";
const TOURNAMENT_PARTICIPANTS_KEY = "ranking_margarita_tournament_participants_v2";

export function loadPlayers(): Player[] {
  try {
    const saved = localStorage.getItem(PLAYERS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading players from localStorage:", e);
  }
  return initialData.players as Player[];
}

export function savePlayers(players: Player[]) {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
}

export function loadMatches(): Match[] {
  try {
    const saved = localStorage.getItem(MATCHES_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading matches from localStorage:", e);
  }
  return initialData.matches as Match[];
}

export function saveMatches(matches: Match[]) {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
}

export function loadTournaments(): Tournament[] {
  try {
    const saved = localStorage.getItem(TOURNAMENTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading tournaments from localStorage:", e);
  }
  return initialData.tournaments as Tournament[];
}

export function saveTournaments(tournaments: Tournament[]) {
  localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(tournaments));
}

export function loadTournamentMatches(): TournamentMatch[] {
  try {
    const saved = localStorage.getItem(TOURNAMENT_MATCHES_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading tournament matches from localStorage:", e);
  }
  return initialData.tournament_matches as TournamentMatch[];
}

export function saveTournamentMatches(tMatches: TournamentMatch[]) {
  localStorage.setItem(TOURNAMENT_MATCHES_KEY, JSON.stringify(tMatches));
}

export function loadTournamentParticipants(): TournamentParticipant[] {
  try {
    const saved = localStorage.getItem(TOURNAMENT_PARTICIPANTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading tournament participants from localStorage:", e);
  }
  return [];
}

export function saveTournamentParticipants(participants: TournamentParticipant[]) {
  localStorage.setItem(TOURNAMENT_PARTICIPANTS_KEY, JSON.stringify(participants));
}

export function resetAllData() {
  localStorage.removeItem(PLAYERS_KEY);
  localStorage.removeItem(MATCHES_KEY);
  localStorage.removeItem(TOURNAMENTS_KEY);
  localStorage.removeItem(TOURNAMENT_MATCHES_KEY);
  localStorage.removeItem(TOURNAMENT_PARTICIPANTS_KEY);
}

// Record match helper using official Reglamento Nueva Esparta 2022
export function createMatchRecord(
  winnerId: string,
  loserId: string,
  winnerSets: number,
  loserSets: number,
  playedAt?: string
): { updatedPlayers: Player[]; newMatch: Match } {
  const players = loadPlayers();
  const winner = players.find((p) => p.id === winnerId);
  const loser = players.find((p) => p.id === loserId);

  if (!winner || !loser) {
    throw new Error("Jugador no encontrado");
  }

  const winnerScoreBefore = winner.score;
  const loserScoreBefore = loser.score;

  // Calculate points exchanged per art. 22
  const pointsExchanged = pointsForMatch(winnerScoreBefore, loserScoreBefore);

  const winnerScoreAfter = winnerScoreBefore + pointsExchanged;
  const loserScoreAfter = Math.max(0, loserScoreBefore - pointsExchanged);

  winner.score = winnerScoreAfter;
  winner.updated_at = new Date().toISOString();

  loser.score = loserScoreAfter;
  loser.updated_at = new Date().toISOString();

  const newMatch: Match = {
    id: crypto.randomUUID ? crypto.randomUUID() : `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    winner_id: winnerId,
    loser_id: loserId,
    winner_sets: winnerSets,
    loser_sets: loserSets,
    winner_score_before: winnerScoreBefore,
    loser_score_before: loserScoreBefore,
    winner_score_after: winnerScoreAfter,
    loser_score_after: loserScoreAfter,
    points_exchanged: pointsExchanged,
    played_at: playedAt || new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  };

  const matches = loadMatches();
  const updatedMatches = [newMatch, ...matches];

  savePlayers(players);
  saveMatches(updatedMatches);

  return { updatedPlayers: players, newMatch };
}

// Revert and delete match per Art. 22 rules
export function deleteMatchRecord(matchId: string): { success: boolean } {
  const matches = loadMatches();
  const match = matches.find((m) => m.id === matchId);
  if (!match) return { success: true };

  const players = loadPlayers();
  const winner = players.find((p) => p.id === match.winner_id);
  const loser = players.find((p) => p.id === match.loser_id);

  if (winner) {
    winner.score = Math.max(0, winner.score - match.points_exchanged);
    winner.updated_at = new Date().toISOString();
  }
  if (loser) {
    loser.score = loser.score + match.points_exchanged;
    loser.updated_at = new Date().toISOString();
  }

  const remaining = matches.filter((m) => m.id !== matchId);
  savePlayers(players);
  saveMatches(remaining);

  return { success: true };
}

// Edit match helper: revert previous points and apply new ones
export function editMatchRecord(
  matchId: string,
  newWinnerId: string,
  newLoserId: string,
  winnerSets: number,
  loserSets: number,
  playedAt?: string
): { success: boolean; match: Match } {
  const matches = loadMatches();
  const matchIndex = matches.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) {
    throw new Error("Partido no encontrado");
  }

  const oldMatch = matches[matchIndex];
  const players = loadPlayers();

  // 1. Revert old points
  const oldWinner = players.find((p) => p.id === oldMatch.winner_id);
  const oldLoser = players.find((p) => p.id === oldMatch.loser_id);
  if (oldWinner) {
    oldWinner.score = Math.max(0, oldWinner.score - oldMatch.points_exchanged);
    oldWinner.updated_at = new Date().toISOString();
  }
  if (oldLoser) {
    oldLoser.score = oldLoser.score + oldMatch.points_exchanged;
    oldLoser.updated_at = new Date().toISOString();
  }

  // 2. Apply new points
  const newWinner = players.find((p) => p.id === newWinnerId);
  const newLoser = players.find((p) => p.id === newLoserId);
  if (!newWinner || !newLoser) {
    throw new Error("Jugador no encontrado para la actualización");
  }

  const winnerScoreBefore = newWinner.score;
  const loserScoreBefore = newLoser.score;
  const pointsExchanged = pointsForMatch(winnerScoreBefore, loserScoreBefore);

  const winnerScoreAfter = winnerScoreBefore + pointsExchanged;
  const loserScoreAfter = Math.max(0, loserScoreBefore - pointsExchanged);

  newWinner.score = winnerScoreAfter;
  newWinner.updated_at = new Date().toISOString();

  newLoser.score = loserScoreAfter;
  newLoser.updated_at = new Date().toISOString();

  const updatedMatch: Match = {
    ...oldMatch,
    winner_id: newWinnerId,
    loser_id: newLoserId,
    winner_sets: winnerSets,
    loser_sets: loserSets,
    winner_score_before: winnerScoreBefore,
    loser_score_before: loserScoreBefore,
    winner_score_after: winnerScoreAfter,
    loser_score_after: loserScoreAfter,
    points_exchanged: pointsExchanged,
    played_at: playedAt || oldMatch.played_at,
  };

  matches[matchIndex] = updatedMatch;
  savePlayers(players);
  saveMatches(matches);

  return { success: true, match: updatedMatch };
}
