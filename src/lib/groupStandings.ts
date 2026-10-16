import { TournamentMatch } from "./types";

/**
 * Estadísticas individuales de un jugador dentro de un grupo.
 */
export type PlayerGroupStats = {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  /** setsWon - setsLost */
  setsDiff: number;
  /** setsWon / setsLost  (Infinity si setsLost === 0) */
  setsRatio: number;
  /** Posición final (1-based) tras desempate */
  position: number;
  /** Texto breve del criterio que determinó la posición (para UI) */
  tiebreakNote: string;
};

/**
 * Resultado agrupado por etiqueta de grupo.
 */
export type GroupStandingsResult = {
  label: string;
  standings: PlayerGroupStats[];
};

// ────────────────────────────────────────────────
// Helpers internos
// ────────────────────────────────────────────────

type RawStats = {
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
};

function emptyStats(): RawStats {
  return { played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0 };
}

/**
 * Extrae las estadísticas brutas de un conjunto de partidos para los jugadores indicados.
 * Si `playerIds` es undefined se infieren de los partidos.
 */
function computeRaw(
  matches: TournamentMatch[],
  playerIds?: string[],
): Map<string, RawStats> {
  const stats = new Map<string, RawStats>();
  const ensure = (id: string) => {
    if (!stats.has(id)) stats.set(id, emptyStats());
    return stats.get(id)!;
  };
  // Pre-seed para que aparezcan jugadores sin partidos jugados
  playerIds?.forEach((id) => ensure(id));

  for (const m of matches) {
    if (!m.player1_id || !m.player2_id || !m.winner_id) continue;
    const a = ensure(m.player1_id);
    const b = ensure(m.player2_id);
    const s1 = m.player1_sets ?? 0;
    const s2 = m.player2_sets ?? 0;
    a.played++;
    b.played++;
    a.setsWon += s1;
    a.setsLost += s2;
    b.setsWon += s2;
    b.setsLost += s1;
    if (m.winner_id === m.player1_id) {
      a.wins++;
      b.losses++;
    } else {
      b.wins++;
      a.losses++;
    }
  }
  return stats;
}

/**
 * Compara dos jugadores usando las columnas básicas:
 *   1) Más victorias
 *   2) Mayor ratio de sets
 *   3) Mayor diferencia de sets
 * Devuelve < 0 si `a` va primero, > 0 si `b` va primero.
 */
function compareBasic(a: RawStats, b: RawStats): number {
  // 1. Victorias desc
  if (b.wins !== a.wins) return b.wins - a.wins;
  // 2. Ratio de sets desc (mayor es mejor)
  const ratioA = a.setsLost === 0 ? Infinity : a.setsWon / a.setsLost;
  const ratioB = b.setsLost === 0 ? Infinity : b.setsWon / b.setsLost;
  if (ratioB !== ratioA) {
    if (ratioA === Infinity && ratioB !== Infinity) return -1;
    if (ratioB === Infinity && ratioA !== Infinity) return 1;
    return ratioB - ratioA;
  }
  // 3. Diferencia de sets desc
  const diffA = a.setsWon - a.setsLost;
  const diffB = b.setsWon - b.setsLost;
  if (diffB !== diffA) return diffB - diffA;
  return 0;
}

/**
 * Devuelve el id del ganador del enfrentamiento directo entre `idA` y `idB`
 * dentro de `matches`. Si no jugaron, devuelve null.
 * Si jugaron más de una vez, usa el resultado acumulado (más victorias entre sí).
 */
function headToHeadWinner(
  matches: TournamentMatch[],
  idA: string,
  idB: string,
): string | null {
  let winsA = 0;
  let winsB = 0;
  for (const m of matches) {
    const involves =
      (m.player1_id === idA && m.player2_id === idB) ||
      (m.player1_id === idB && m.player2_id === idA);
    if (!involves || !m.winner_id) continue;
    if (m.winner_id === idA) winsA++;
    else if (m.winner_id === idB) winsB++;
  }
  if (winsA > winsB) return idA;
  if (winsB > winsA) return idB;
  return null;
}

/**
 * Criterio de desempate completo según reglamento de TdM:
 *   1) Victorias totales en el grupo
 *   2) Enfrentamiento directo (si son exactamente 2 empatados)
 *   3) Ratio de sets (sets ganados / sets perdidos)
 *   4) Diferencia de sets (sets ganados − sets perdidos)
 *   5) Mini-tabla entre empatados (si son ≥3 empatados con mismas victorias)
 *   6) Puntaje Elo original (fallback)
 */
function rankPlayers(
  ids: string[],
  allGroupMatches: TournamentMatch[],
  playerScores?: Map<string, number>,
): { sorted: string[]; notes: Map<string, string> } {
  if (ids.length <= 1) {
    const notes = new Map<string, string>();
    if (ids.length === 1) notes.set(ids[0], "");
    return { sorted: [...ids], notes };
  }

  const stats = computeRaw(allGroupMatches, ids);
  const notes = new Map<string, string>();

  // Agrupar por cantidad de victorias
  const byWins = new Map<number, string[]>();
  for (const id of ids) {
    const w = stats.get(id)!.wins;
    if (!byWins.has(w)) byWins.set(w, []);
    byWins.get(w)!.push(id);
  }

  // Ordenar los tiers por victorias desc
  const tiers = [...byWins.entries()].sort((a, b) => b[0] - a[0]);
  const result: string[] = [];

  for (const [, tiedIds] of tiers) {
    if (tiedIds.length === 1) {
      notes.set(tiedIds[0], "");
      result.push(tiedIds[0]);
      continue;
    }

    // Son 2 o más empatados en victorias
    if (tiedIds.length === 2) {
      const [idA, idB] = tiedIds;
      const h2h = headToHeadWinner(allGroupMatches, idA, idB);
      if (h2h) {
        const loser = h2h === idA ? idB : idA;
        notes.set(h2h, "Directo");
        notes.set(loser, "Directo");
        result.push(h2h, loser);
        continue;
      }
    }

    // ≥3 empatados o h2h no resolutivo → mini-tabla entre empatados
    if (tiedIds.length >= 3) {
      const miniMatches = allGroupMatches.filter(
        (m) =>
          m.player1_id &&
          m.player2_id &&
          tiedIds.includes(m.player1_id) &&
          tiedIds.includes(m.player2_id),
      );
      const miniStats = computeRaw(miniMatches, tiedIds);
      const miniSorted = [...tiedIds].sort((a, b) => {
        const sa = miniStats.get(a)!;
        const sb = miniStats.get(b)!;
        const cmp = compareBasic(sa, sb);
        if (cmp !== 0) return cmp;
        // Fallback: Elo original
        const eloA = playerScores?.get(a) ?? 0;
        const eloB = playerScores?.get(b) ?? 0;
        return eloB - eloA;
      });
      const allSameInMini = miniSorted.every(
        (id) => miniStats.get(id)!.wins === miniStats.get(miniSorted[0])!.wins,
      );
      for (const id of miniSorted) {
        notes.set(id, allSameInMini ? "Ratio sets" : "Mini-tabla");
      }
      result.push(...miniSorted);
      continue;
    }

    // 2 empatados sin h2h → ratio de sets, diff de sets, Elo
    const sorted = [...tiedIds].sort((a, b) => {
      const sa = stats.get(a)!;
      const sb = stats.get(b)!;
      const cmp = compareBasic(sa, sb);
      if (cmp !== 0) return cmp;
      const eloA = playerScores?.get(a) ?? 0;
      const eloB = playerScores?.get(b) ?? 0;
      return eloB - eloA;
    });
    for (const id of sorted) {
      notes.set(id, "Ratio sets");
    }
    result.push(...sorted);
  }

  return { sorted: result, notes };
}

// ────────────────────────────────────────────────
// API pública
// ────────────────────────────────────────────────

/**
 * Calcula las clasificaciones completas para todos los grupos de un torneo.
 *
 * @param groupMatches  Partidos de fase de grupo del torneo.
 * @param playerScores  Mapa playerId → score (Elo) para fallback de desempate.
 * @returns Array de resultados por grupo, cada uno con standings ordenados.
 */
export function computeGroupStandings(
  groupMatches: TournamentMatch[],
  playerScores?: Map<string, number>,
): GroupStandingsResult[] {
  if (groupMatches.length === 0) return [];

  // Identificar etiquetas de grupo
  const labels = Array.from(
    new Set(groupMatches.map((m) => m.group_label || "")),
  ).sort();

  const results: GroupStandingsResult[] = [];

  for (const label of labels) {
    const gMatches = groupMatches.filter((m) => (m.group_label || "") === label);

    // Extraer todos los jugadores del grupo
    const playerIds = Array.from(
      new Set(
        gMatches.flatMap((m) =>
          [m.player1_id, m.player2_id].filter((x): x is string => !!x),
        ),
      ),
    );

    const rawStats = computeRaw(gMatches, playerIds);
    const { sorted, notes } = rankPlayers(
      playerIds,
      gMatches,
      playerScores,
    );

    const standings: PlayerGroupStats[] = sorted.map((id, idx) => {
      const raw = rawStats.get(id) ?? emptyStats();
      const setsRatio =
        raw.setsLost === 0
          ? raw.setsWon > 0
            ? Infinity
            : 0
          : raw.setsWon / raw.setsLost;
      return {
        playerId: id,
        played: raw.played,
        wins: raw.wins,
        losses: raw.losses,
        setsWon: raw.setsWon,
        setsLost: raw.setsLost,
        setsDiff: raw.setsWon - raw.setsLost,
        setsRatio,
        position: idx + 1,
        tiebreakNote: notes.get(id) ?? "",
      };
    });

    results.push({ label, standings });
  }

  return results;
}

/**
 * Devuelve los clasificados de fase de grupos según orden de siembra para la
 * fase eliminatoria:
 *   posición 1 de cada grupo primero, luego posición 2, etc.
 *
 * @param standings     Resultado de `computeGroupStandings`.
 * @param qualifyCount  Cuántos clasifican por grupo.
 * @returns Lista ordenada de playerIds para sembrar en el bracket.
 */
export function getQualifiersForKnockout(
  standings: GroupStandingsResult[],
  qualifyCount: number,
): string[] {
  const qualifiers: string[] = [];
  for (let pos = 0; pos < qualifyCount; pos++) {
    for (const group of standings) {
      const player = group.standings[pos];
      if (player) qualifiers.push(player.playerId);
    }
  }
  return qualifiers;
}
