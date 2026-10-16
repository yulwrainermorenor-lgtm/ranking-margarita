// Tabla del Reglamento Ranking Nueva Esparta 2022 (art. 22)
// Mayor R = mayor ranking (más puntos). Menor R = menor ranking.
// Devuelve los puntos que gana el ganador. El perdedor pierde la misma cantidad.
export function pointsForMatch(winnerScore: number, loserScore: number): number {
  const diff = Math.abs(winnerScore - loserScore);
  const winnerIsHigher = winnerScore >= loserScore;
  const table: Array<[number, number, number]> = [
    [24, 8, 8],
    [49, 7, 10],
    [99, 5, 12],
    [149, 3, 15],
    [199, 2, 20],
    [250, 1, 26],
    [Infinity, 0, 32],
  ];
  for (const [maxDiff, mayor, menor] of table) {
    if (diff <= maxDiff) return winnerIsHigher ? mayor : menor;
  }
  return 0;
}

export const POINTS_TABLE: Array<{ range: string; mayor: number; menor: number }> = [
  { range: "0 – 24", mayor: 8, menor: 8 },
  { range: "25 – 49", mayor: 7, menor: 10 },
  { range: "50 – 99", mayor: 5, menor: 12 },
  { range: "100 – 149", mayor: 3, menor: 15 },
  { range: "150 – 199", mayor: 2, menor: 20 },
  { range: "200 – 250", mayor: 1, menor: 26 },
  { range: "> 250", mayor: 0, menor: 32 },
];