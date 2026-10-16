import initialData from "../data/initialData.json";
import { Player, Match, Tournament, TournamentMatch, TournamentParticipant } from "./types";
import { pointsForMatch } from "./points";
import { getJSON, setJSON, removeJSON } from "./storage";

const PLAYERS_KEY = "ranking_margarita_players_v2";
const MATCHES_KEY = "ranking_margarita_matches_v2";
const TOURNAMENTS_KEY = "ranking_margarita_tournaments_v2";
const TOURNAMENT_MATCHES_KEY = "ranking_margarita_tournament_matches_v2";
const TOURNAMENT_PARTICIPANTS_KEY = "ranking_margarita_tournament_participants_v2";

export function loadPlayers(): Player[] {
  return getJSON(PLAYERS_KEY, initialData.players as Player[]);
}

export function savePlayers(players: Player[]) {
  setJSON(PLAYERS_KEY, players);
}

export function loadMatches(): Match[] {
  return getJSON(MATCHES_KEY, initialData.matches as Match[]);
}

export function saveMatches(matches: Match[]) {
  setJSON(MATCHES_KEY, matches);
}

export function loadTournaments(): Tournament[] {
  return getJSON(TOURNAMENTS_KEY, initialData.tournaments as Tournament[]);
}

export function saveTournaments(tournaments: Tournament[]) {
  setJSON(TOURNAMENTS_KEY, tournaments);
}

export function loadTournamentMatches(): TournamentMatch[] {
  return getJSON(TOURNAMENT_MATCHES_KEY, initialData.tournament_matches as TournamentMatch[]);
}

export function saveTournamentMatches(tMatches: TournamentMatch[]) {
  setJSON(TOURNAMENT_MATCHES_KEY, tMatches);
}

export function loadTournamentParticipants(): TournamentParticipant[] {
  return getJSON(TOURNAMENT_PARTICIPANTS_KEY, []);
}

export function saveTournamentParticipants(participants: TournamentParticipant[]) {
  setJSON(TOURNAMENT_PARTICIPANTS_KEY, participants);
}

export function resetAllData() {
  removeJSON(PLAYERS_KEY);
  removeJSON(MATCHES_KEY);
  removeJSON(TOURNAMENTS_KEY);
  removeJSON(TOURNAMENT_MATCHES_KEY);
  removeJSON(TOURNAMENT_PARTICIPANTS_KEY);
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

  if (winnerId === loserId) {
    throw new Error("Un atleta no puede jugar contra sí mismo");
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

// ────────────────────────────────────────────────
// Deltas realmente aplicados por un partido
// ────────────────────────────────────────────────
// El perdedor nunca baja de 0, así que el cambio real de su puntaje puede ser
// menor que `points_exchanged`. Revertir con `points_exchanged` inventa puntos.
// Los partidos ya guardados traen before/after, por eso no hace falta migrar datos.

/** Puntos que el ganador sumó realmente en ese partido. */
export function winnerDelta(match: Match): number {
  return match.winner_score_after - match.winner_score_before;
}

/** Puntos que el perdedor restó realmente (0 o menos si quedó en el piso 0). */
export function loserDelta(match: Match): number {
  return match.loser_score_before - match.loser_score_after;
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
    winner.score = Math.max(0, winner.score - winnerDelta(match));
    winner.updated_at = new Date().toISOString();
  }
  if (loser) {
    loser.score = Math.max(0, loser.score + loserDelta(match));
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
    oldWinner.score = Math.max(0, oldWinner.score - winnerDelta(oldMatch));
    oldWinner.updated_at = new Date().toISOString();
  }
  if (oldLoser) {
    oldLoser.score = Math.max(0, oldLoser.score + loserDelta(oldMatch));
    oldLoser.updated_at = new Date().toISOString();
  }

  // 2. Apply new points
  const newWinner = players.find((p) => p.id === newWinnerId);
  const newLoser = players.find((p) => p.id === newLoserId);
  if (!newWinner || !newLoser) {
    throw new Error("Jugador no encontrado para la actualización");
  }

  if (newWinnerId === newLoserId) {
    throw new Error("Un atleta no puede jugar contra sí mismo");
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

// ────────────────────────────────────────────────
// Auditoría del log: recálculo y reparación de puntajes
// ────────────────────────────────────────────────

/** Orden cronológico del log: primero la fecha de juego, después la fecha de alta. */
export function orderMatches(matches: Match[]): Match[] {
  return [...matches].sort(
    (a, b) =>
      String(a.played_at || "").localeCompare(String(b.played_at || "")) ||
      String(a.created_at || "").localeCompare(String(b.created_at || "")),
  );
}

export type LogReplay = {
  /** Puntaje que le corresponde a cada atleta según el log. */
  scores: Map<string, number>;
  /** Puntaje desde el que arranca el recálculo de cada atleta. */
  bases: Map<string, number>;
  /** Log reordenado, con before/after y puntos recalculados. */
  matches: Match[];
  /** Atletas que aparecen al menos una vez en el log. */
  inLog: Set<string>;
};

/**
 * Rehace el log completo en orden cronológico.
 *
 * Para cada atleta el recálculo arranca desde el puntaje que tenía antes de su
 * primer partido registrado (el log es la única fuente confiable: `initial_score`
 * es el puntaje del día en que se importó, no un punto de partida). Los atletas
 * que no aparecen en el log quedan fuera del recálculo y conservan su puntaje.
 */
export function replayMatchLog(matches: Match[], players: Player[]): LogReplay {
  const known = new Set(players.map((p) => p.id));
  const ordered = orderMatches(matches).filter(
    (m) => known.has(m.winner_id) && known.has(m.loser_id),
  );

  const bases = new Map<string, number>();
  for (const m of ordered) {
    if (!bases.has(m.winner_id)) bases.set(m.winner_id, m.winner_score_before);
    if (!bases.has(m.loser_id)) bases.set(m.loser_id, m.loser_score_before);
  }

  const scores = new Map(bases);
  const replayed: Match[] = [];

  for (const m of ordered) {
    const winnerBefore = scores.get(m.winner_id)!;
    const loserBefore = scores.get(m.loser_id)!;
    const pointsExchanged = pointsForMatch(winnerBefore, loserBefore);
    const winnerAfter = winnerBefore + pointsExchanged;
    const loserAfter = Math.max(0, loserBefore - pointsExchanged);

    scores.set(m.winner_id, winnerAfter);
    scores.set(m.loser_id, loserAfter);

    replayed.push({
      ...m,
      winner_score_before: winnerBefore,
      loser_score_before: loserBefore,
      winner_score_after: winnerAfter,
      loser_score_after: loserAfter,
      points_exchanged: pointsExchanged,
    });
  }

  return { scores, bases, matches: replayed, inLog: new Set(bases.keys()) };
}

export type ScoreDrift = {
  playerId: string;
  name: string;
  stored: number;
  expected: number;
  diff: number;
};

export type TrueInitial = { playerId: string; name: string; initial: number; wonPoints: number; suggested: number };

export type DriftReport = {
  drift: ScoreDrift[];
  matchesChanged: number;
  playersInLog: number;
  maxDiff: number;
  trueInitials: TrueInitial[];
};

/**
 * Compara el puntaje guardado con el que sale de rehacer el log.
 * Solo mira atletas que jugaron al menos un partido registrado.
 */
export function computeScoreDrift(): DriftReport {
  const players = loadPlayers();
  const matches = loadMatches();
  const replay = replayMatchLog(matches, players);

  const drift: ScoreDrift[] = [];

  const byId = new Map(players.map((p) => [p.id, p]));
  for (const [playerId, expected] of replay.scores) {
    const player = byId.get(playerId);
    if (!player) continue;
    const diff = player.score - expected;
    if (diff !== 0) {
      drift.push({ playerId, name: player.name, stored: player.score, expected, diff });
    }
  }

  const gains = new Map<string, number>();
  const losses = new Map<string, number>();
  for (const m of matches) {
    const w = byId.get(m.winner_id);
    const l = byId.get(m.loser_id);
    if (!w && !l) continue;
    if (w) {
      gains.set(w.id, (gains.get(w.id) ?? 0) + (m.points_exchanged ?? 0));
    }
    if (l) {
      losses.set(l.id, (losses.get(l.id) ?? 0) + (m.points_exchanged ?? 0));
    }
  }

  const trueInitials: TrueInitial[] = [];
  for (const p of players) {
    if (!gains.has(p.id) && !losses.has(p.id)) continue;
    const wonPts = gains.get(p.id) ?? 0;
    const lostPts = losses.get(p.id) ?? 0;
    const suggested = p.score - wonPts + lostPts;
    trueInitials.push({
      playerId: p.id,
      name: p.name,
      initial: p.initial_score ?? p.score,
      wonPoints: wonPts,
      suggested,
    });
  }
  trueInitials.sort((a, b) => Math.abs(b.suggested - (byId.get(b.playerId)?.initial_score ?? b.suggested)) - Math.abs(a.suggested - (byId.get(a.playerId)?.initial_score ?? a.suggested)));

  drift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const originals = new Map(matches.map((m) => [m.id, m]));
  const matchesChanged = replay.matches.filter((m) => {
    const original = originals.get(m.id);
    return (
      !original ||
      original.winner_score_before !== m.winner_score_before ||
      original.loser_score_before !== m.loser_score_before ||
      original.winner_score_after !== m.winner_score_after ||
      original.loser_score_after !== m.loser_score_after ||
      original.points_exchanged !== m.points_exchanged
    );
  }).length;

  return {
    drift,
    matchesChanged,
    playersInLog: replay.scores.size,
    maxDiff: drift.reduce((max, d) => Math.max(max, Math.abs(d.diff)), 0),
    trueInitials,
  };
}

/**
 * Aplica el recálculo del log: reescribe los puntajes de los atletas y los
 * before/after de cada partido. Devuelve cuánto se corrigió.
 */
export function repairScoresFromLog(): { playersFixed: number; matchesFixed: number; maxDiff: number } {
  const players = loadPlayers();
  const matches = loadMatches();
  const report = computeScoreDrift();
  const replay = replayMatchLog(matches, players);

  const originals = new Map(matches.map((m) => [m.id, m]));
  const now = new Date().toISOString();

  const nextMatches = replay.matches.map((m) => {
    const original = originals.get(m.id);
    const changed =
      !original ||
      original.winner_score_before !== m.winner_score_before ||
      original.loser_score_before !== m.loser_score_before ||
      original.winner_score_after !== m.winner_score_after ||
      original.loser_score_after !== m.loser_score_after ||
      original.points_exchanged !== m.points_exchanged;
    return changed ? { ...m, updated_at: now } : m;
  });
  const nextById = new Map(nextMatches.map((m) => [m.id, m]));
  const matchesOut = matches.map((m) => nextById.get(m.id) ?? m);

  const fixedIds = new Set(report.drift.map((d) => d.playerId));
  const nextPlayers = players.map((p) => {
    if (!fixedIds.has(p.id)) return p;
    return { ...p, score: replay.scores.get(p.id)!, updated_at: now };
  });

  savePlayers(nextPlayers);
  saveMatches(matchesOut);

  return {
    playersFixed: report.drift.length,
    matchesFixed: report.matchesChanged,
    maxDiff: report.maxDiff,
  };
}
