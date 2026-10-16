import { TournamentFormat, TournamentPhase } from "./types";

export type BracketMatchInput = {
  phase: TournamentPhase;
  group_label: string | null;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  next_match_idx: number | null; // index in array
  next_match_slot: number | null;
  next_match_loser_idx: number | null;
};

export function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Standard seeded bracket order for a power-of-two size (e.g. 8 -> [1,8,4,5,2,7,3,6]). */
export function seedOrder(size: number): number[] {
  let rounds: number[][] = [[1, 2]];
  while (rounds[0].length < size) {
    const top = rounds[0];
    const sum = top.length * 2 + 1;
    const next: number[] = [];
    for (const s of top) {
      next.push(s);
      next.push(sum - s);
    }
    rounds = [next];
  }
  return rounds[0];
}

/** Single elimination — input playerIds in bracket slot order (already sembrados). */
export function buildSingleElimination(playerIds: string[]): BracketMatchInput[] {
  const size = nextPow2(Math.max(2, playerIds.length));
  const order = seedOrder(size);
  // Map seed -> player or null (bye)
  const slotPlayers: (string | null)[] = order.map((seed) => playerIds[seed - 1] ?? null);

  const matches: BracketMatchInput[] = [];
  // Build rounds
  const totalRounds = Math.log2(size);
  let prevRoundIdx: number[] = []; // indices of matches in previous round

  // Round 1
  let round = 1;
  for (let i = 0; i < size; i += 2) {
    matches.push({
      phase: "main",
      group_label: null,
      round,
      match_number: i / 2 + 1,
      player1_id: slotPlayers[i],
      player2_id: slotPlayers[i + 1],
      next_match_idx: null,
      next_match_slot: null,
      next_match_loser_idx: null,
    });
    prevRoundIdx.push(matches.length - 1);
  }

  // Subsequent rounds
  for (round = 2; round <= totalRounds; round++) {
    const thisRoundIdx: number[] = [];
    const count = prevRoundIdx.length / 2;
    for (let i = 0; i < count; i++) {
      matches.push({
        phase: "main",
        group_label: null,
        round,
        match_number: i + 1,
        player1_id: null,
        player2_id: null,
        next_match_idx: null,
        next_match_slot: null,
        next_match_loser_idx: null,
      });
      const newIdx = matches.length - 1;
      thisRoundIdx.push(newIdx);
      // Wire previous matches into this one
      const a = prevRoundIdx[i * 2];
      const b = prevRoundIdx[i * 2 + 1];
      matches[a].next_match_idx = newIdx;
      matches[a].next_match_slot = 1;
      matches[b].next_match_idx = newIdx;
      matches[b].next_match_slot = 2;
    }
    prevRoundIdx = thisRoundIdx;
  }

  // Auto-advance byes in round 1
  for (const m of matches.filter((x) => x.round === 1)) {
    if (m.player1_id && !m.player2_id && m.next_match_idx != null) {
      const nm = matches[m.next_match_idx];
      if (m.next_match_slot === 1) nm.player1_id = m.player1_id;
      else nm.player2_id = m.player1_id;
    } else if (!m.player1_id && m.player2_id && m.next_match_idx != null) {
      const nm = matches[m.next_match_idx];
      if (m.next_match_slot === 1) nm.player1_id = m.player2_id;
      else nm.player2_id = m.player2_id;
    }
  }

  // 3rd place match (when there are semifinals, i.e. size >= 4)
  if (totalRounds >= 2) {
    const semiIndices: number[] = [];
    matches.forEach((m, i) => {
      if (m.round === totalRounds - 1) semiIndices.push(i);
    });
    if (semiIndices.length === 2) {
      matches.push({
        phase: "third_place",
        group_label: null,
        round: totalRounds,
        match_number: 2,
        player1_id: null,
        player2_id: null,
        next_match_idx: null,
        next_match_slot: null,
        next_match_loser_idx: null,
      });
      const tpIdx = matches.length - 1;
      matches[semiIndices[0]].next_match_loser_idx = tpIdx;
      matches[semiIndices[1]].next_match_loser_idx = tpIdx;
    }
  }

  return matches;
}

/** Round robin within a single group. */
export function buildRoundRobin(
  playerIds: string[],
  groupLabel: string,
): BracketMatchInput[] {
  const matches: BracketMatchInput[] = [];
  if (playerIds.length < 2) return matches;

  // Orden oficial de juego para los tamaños de grupo más habituales.
  // Los índices son las posiciones 1-based dentro del grupo.
  const fixedSchedules: Record<number, Array<[number, number]>> = {
    3: [[1, 3], [2, 3], [1, 2]],
    4: [[1, 4], [2, 3], [1, 3], [2, 4], [3, 4], [1, 2]],
  };
  const fixedSchedule = fixedSchedules[playerIds.length];
  if (fixedSchedule) {
    return fixedSchedule.map(([player1, player2], index) => ({
      phase: "group",
      group_label: groupLabel,
      round: 1,
      match_number: index + 1,
      player1_id: playerIds[player1 - 1],
      player2_id: playerIds[player2 - 1],
      next_match_idx: null,
      next_match_slot: null,
      next_match_loser_idx: null,
    }));
  }

  // Circle (Berger) method: minimiza partidos consecutivos del mismo jugador.
  const BYE = "__bye__";
  const arr: string[] = [...playerIds];
  if (arr.length % 2 === 1) arr.push(BYE);
  const n = arr.length;
  const rounds = n - 1;
  let mn = 1;
  // Trabajamos sobre una copia rotable
  const ring = [...arr];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      matches.push({
        phase: "group",
        group_label: groupLabel,
        round: 1,
        match_number: mn++,
        player1_id: a,
        player2_id: b,
        next_match_idx: null,
        next_match_slot: null,
        next_match_loser_idx: null,
      });
    }
    // Rotar todos menos el primero: mover el último a la posición 1
    const last = ring.pop()!;
    ring.splice(1, 0, last);
  }
  return matches;
}

/**
 * Groups + elimination. Splits players into N groups (snake distribution),
 * generates round robin in each, plus an empty knockout bracket for the
 * top `qualifyPerGroup` of each group (admin will plug them in once groups end).
 */
export function buildGroupsElimination(
  playerIds: string[],
  groupCount: number,
  qualifyPerGroup: number,
  presetGroups?: string[][],
): BracketMatchInput[] {
  let groups: string[][];
  if (presetGroups && presetGroups.length > 0) {
    groups = presetGroups.map((g) => [...g]);
  } else {
    groups = Array.from({ length: groupCount }, () => []);
    // Snake distribution preserves seed balance
    playerIds.forEach((pid, idx) => {
      const round = Math.floor(idx / groupCount);
      const pos = idx % groupCount;
      const groupIdx = round % 2 === 0 ? pos : groupCount - 1 - pos;
      groups[groupIdx].push(pid);
    });
  }

  const matches: BracketMatchInput[] = [];
  groups.forEach((gp, idx) => {
    const label = String.fromCharCode(65 + idx); // A, B, C...
    matches.push(...buildRoundRobin(gp, label));
  });

  // Empty elimination bracket for qualifiers — placeholders, filled in later by admin
  const totalQualifiers = groups.length * qualifyPerGroup;
  if (totalQualifiers >= 2) {
    const empty = Array.from({ length: totalQualifiers }, () => "" as string);
    const koMatches = buildSingleElimination(empty);
    // Convert back: empty strings = null, and offset round so it comes after groups
    for (const m of koMatches) {
      m.player1_id = m.player1_id || null;
      m.player2_id = m.player2_id || null;
      m.round = m.round + 1; // groups are round 1
      if (m.phase !== "third_place") m.phase = "main";
    }
    // Re-link next_match_idx will be re-resolved relative to this slice
    const offset = matches.length;
    for (const m of koMatches) {
      if (m.next_match_idx != null) m.next_match_idx += offset;
      if (m.next_match_loser_idx != null) m.next_match_loser_idx += offset;
    }
    matches.push(...koMatches);
  }

  return matches;
}

/** Double elimination — winners (upper) and losers (lower) brackets + final. */
export function buildDoubleElimination(playerIds: string[]): BracketMatchInput[] {
  // Build upper bracket as single elim
  const upper = buildSingleElimination(playerIds).map((m) => ({
    ...m,
    phase: "upper" as TournamentPhase,
  }));
  // For simplicity, lower bracket and grand final are created as placeholder shells
  // that the admin progresses manually (avoids fragile auto-loser routing for arbitrary brackets).
  const upperFinalIdx = upper.length - 1;
  const matches: BracketMatchInput[] = [...upper];

  // Compute lower bracket size from upper rounds
  const upperRounds = Math.max(...upper.map((m) => m.round));
  // Simple lower bracket: one match per upper round consolidating losers
  // (cleaner, easier to play in person; admin enters loser into next lower match)
  let prevLowerIdx: number | null = null;
  for (let r = 1; r < upperRounds; r++) {
    const lowerIdx = matches.length;
    matches.push({
      phase: "lower",
      group_label: null,
      round: r,
      match_number: 1,
      player1_id: null,
      player2_id: null,
      next_match_idx: null,
      next_match_slot: null,
      next_match_loser_idx: null,
    });
    if (prevLowerIdx != null) {
      matches[prevLowerIdx].next_match_idx = lowerIdx;
      matches[prevLowerIdx].next_match_slot = 1;
    }
    prevLowerIdx = lowerIdx;
  }

  // Grand final
  const grandIdx = matches.length;
  matches.push({
    phase: "final",
    group_label: null,
    round: upperRounds + 1,
    match_number: 1,
    player1_id: null,
    player2_id: null,
    next_match_idx: null,
    next_match_slot: null,
    next_match_loser_idx: null,
  });
  // Wire upper final winner -> grand final slot 1
  matches[upperFinalIdx].next_match_idx = grandIdx;
  matches[upperFinalIdx].next_match_slot = 1;
  // Wire last lower -> grand final slot 2
  if (prevLowerIdx != null) {
    matches[prevLowerIdx].next_match_idx = grandIdx;
    matches[prevLowerIdx].next_match_slot = 2;
  }

  return matches;
}

export function buildBracket(
  format: TournamentFormat,
  playerIds: string[],
  opts?: { groupCount?: number; qualifyPerGroup?: number; presetGroups?: string[][] },
): BracketMatchInput[] {
  switch (format) {
    case "single_elimination":
      return buildSingleElimination(playerIds);
    case "double_elimination":
      return buildDoubleElimination(playerIds);
    case "groups_elimination":
      return buildGroupsElimination(
        playerIds,
        opts?.groupCount ?? 2,
        opts?.qualifyPerGroup ?? 2,
        opts?.presetGroups,
      );
  }
}

/**
 * Sorteo de grupos por bombos según puntaje.
 * - Ordena jugadores por puntaje desc.
 * - Calcula tamaños de grupo lo más parejos posible (los primeros grupos reciben el extra).
 * - Crea `maxSize` bombos: bombo 1 = top de cada grupo, bombo 2 = segundos, etc.
 * - Mezcla aleatoriamente cada bombo y asigna a los grupos que aún necesitan en esa posición.
 */
export function drawGroupsByRanking(
  players: { id: string; score: number }[],
  groupCount: number,
  customSizes?: number[],
): string[][] {
  const n = players.length;
  if (groupCount < 1 || n === 0) return [];

  const sorted = [...players].sort((a, b) => b.score - a.score);

  let sizes: number[];
  if (customSizes && customSizes.length === groupCount) {
    sizes = [...customSizes];
    // Ajustar la suma al total de jugadores: si sobran, añadir al primero; si faltan, recortar del último
    let sum = sizes.reduce((a, b) => a + b, 0);
    let i = 0;
    while (sum < n) {
      sizes[i % groupCount]++;
      sum++;
      i++;
    }
    let j = groupCount - 1;
    while (sum > n) {
      if (sizes[j] > 0) {
        sizes[j]--;
        sum--;
      }
      j = (j - 1 + groupCount) % groupCount;
    }
  } else {
    // Tamaños: distribuir el resto entre los primeros grupos
    const base = Math.floor(n / groupCount);
    const extra = n % groupCount;
    sizes = Array.from({ length: groupCount }, (_, i) =>
      i < extra ? base + 1 : base,
    );
  }
  const maxSize = Math.max(...sizes);

  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  let cursor = 0;
  for (let bombo = 0; bombo < maxSize; bombo++) {
    // Grupos elegibles en este bombo: los que aún no tienen jugador en esta posición
    const eligible: number[] = [];
    for (let g = 0; g < groupCount; g++) {
      if (sizes[g] > bombo) eligible.push(g);
    }
    const slice = sorted.slice(cursor, cursor + eligible.length);
    cursor += eligible.length;
    // Fisher-Yates shuffle
    for (let i = slice.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slice[i], slice[j]] = [slice[j], slice[i]];
    }
    eligible.forEach((g, i) => {
      if (slice[i]) groups[g].push(slice[i].id);
    });
  }
  return groups;
}

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  single_elimination: "Eliminación simple",
  double_elimination: "Eliminación doble",
  groups_elimination: "Grupos + eliminación",
};

/**
 * Sorteo serpiente: ordena por puntaje desc y distribuye en serpentina
 * (1→G1, 2→G2, ..., N→GN, N+1→GN, N+2→GN-1, ...). Respeta tamaños custom.
 */
export function drawGroupsSnake(
  players: { id: string; score: number }[],
  groupCount: number,
  customSizes?: number[],
): string[][] {
  const n = players.length;
  if (groupCount < 1 || n === 0) return [];

  const sorted = [...players].sort((a, b) => b.score - a.score);

  let sizes: number[];
  if (customSizes && customSizes.length === groupCount) {
    sizes = [...customSizes];
    let sum = sizes.reduce((a, b) => a + b, 0);
    let i = 0;
    while (sum < n) {
      sizes[i % groupCount]++;
      sum++;
      i++;
    }
    let j = groupCount - 1;
    while (sum > n) {
      if (sizes[j] > 0) {
        sizes[j]--;
        sum--;
      }
      j = (j - 1 + groupCount) % groupCount;
    }
  } else {
    const base = Math.floor(n / groupCount);
    const extra = n % groupCount;
    sizes = Array.from({ length: groupCount }, (_, i) =>
      i < extra ? base + 1 : base,
    );
  }

  // Serpentina real: 1→A, 2→B, ..., N→GN, N+1→GN, N+2→GN-1, ..., 2N→A, 2N+1→A, ...
  // Se saltan los grupos que ya alcanzaron su tamaño máximo.
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  // Precalcular orden de grupos en serpentina extendida hasta cubrir a todos
  const order: number[] = [];
  let forward = true;
  while (order.length < n) {
    const pass = forward
      ? Array.from({ length: groupCount }, (_, i) => i)
      : Array.from({ length: groupCount }, (_, i) => groupCount - 1 - i);
    for (const g of pass) order.push(g);
    forward = !forward;
  }
  let idx = 0;
  for (const p of sorted) {
    let tries = 0;
    while (
      idx < order.length &&
      groups[order[idx]].length >= sizes[order[idx]] &&
      tries < order.length
    ) {
      idx++;
      tries++;
    }
    if (idx >= order.length) break;
    groups[order[idx]].push(p.id);
    idx++;
  }
  return groups;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  in_progress: "En curso",
  finished: "Finalizado",
};