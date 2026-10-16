function pointsForMatch(winnerScore, loserScore) {
  const diff = Math.abs(winnerScore - loserScore);
  const winnerIsHigher = winnerScore >= loserScore;
  const table = [
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

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

console.log("=== 1. VERIFICACIÓN ART. 22 REGLAMENTO DE PUNTOS ===");
// Mayor gana
assert(pointsForMatch(1520, 1500) === 8, "Diff 20 (mayor gana) -> 8 pts");
assert(pointsForMatch(1540, 1500) === 7, "Diff 40 (mayor gana) -> 7 pts");
assert(pointsForMatch(1580, 1500) === 5, "Diff 80 (mayor gana) -> 5 pts");
assert(pointsForMatch(1620, 1500) === 3, "Diff 120 (mayor gana) -> 3 pts");
assert(pointsForMatch(1680, 1500) === 2, "Diff 180 (mayor gana) -> 2 pts");
assert(pointsForMatch(1740, 1500) === 1, "Diff 240 (mayor gana) -> 1 pt");
assert(pointsForMatch(1800, 1500) === 0, "Diff 300 (mayor gana) -> 0 pts");

// Menor gana (Upset)
assert(pointsForMatch(1500, 1520) === 8, "Diff 20 (menor gana) -> 8 pts");
assert(pointsForMatch(1500, 1540) === 10, "Diff 40 (menor gana) -> 10 pts");
assert(pointsForMatch(1500, 1580) === 12, "Diff 80 (menor gana) -> 12 pts");
assert(pointsForMatch(1500, 1620) === 15, "Diff 120 (menor gana) -> 15 pts");
assert(pointsForMatch(1500, 1680) === 20, "Diff 180 (menor gana) -> 20 pts");
assert(pointsForMatch(1500, 1740) === 26, "Diff 240 (menor gana) -> 26 pts");
assert(pointsForMatch(1500, 1800) === 32, "Diff 300 (menor gana) -> 32 pts");

console.log("\n=== 2. VERIFICACIÓN DE REVERSIÓN Y EDICIÓN ELO ===");
let players = [
  { id: "A", name: "Carlos", score: 1500 },
  { id: "B", name: "Miguel", score: 1450 }
];

// Partido 1: Carlos (1500) le gana a Miguel (1450). Diff 50 -> 5 pts
let diff = Math.abs(players[0].score - players[1].score);
let pts = pointsForMatch(players[0].score, players[1].score);
assert(pts === 5, "Carlos gana 5 pts");
players[0].score += pts;
players[1].score -= pts;
assert(players[0].score === 1505 && players[1].score === 1445, "Carlos 1505, Miguel 1445");

// Edición: Corregir el partido -> Miguel le ganó a Carlos
// 1) Reversión del partido anterior
players[0].score -= pts;
players[1].score += pts;
assert(players[0].score === 1500 && players[1].score === 1450, "Scores restaurados a 1500 y 1450");

// 2) Aplicar resultado corregido: Miguel (1450) le gana a Carlos (1500) -> Menor gana, diff 50 -> 12 pts
let newPts = pointsForMatch(players[1].score, players[0].score);
assert(newPts === 12, "Miguel gana 12 pts por victoria ante mayor");
players[1].score += newPts;
players[0].score -= newPts;
assert(players[1].score === 1462, "Miguel score corregido a 1462");
assert(players[0].score === 1488, "Carlos score corregido a 1488");

// Eliminación de partido: se anula el partido
players[1].score -= newPts;
players[0].score += newPts;
assert(players[0].score === 1500 && players[1].score === 1450, "Scores restablecidos exactamente tras eliminación");

console.log("\n🎉 TODAS LAS PRUEBAS DE LÓGICA ELO Y REVERSIÓN FUNCIONAN A LA PERFECCIÓN!");
