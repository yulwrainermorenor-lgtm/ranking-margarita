import { beforeEach, describe, expect, it } from "vitest";
import {
  computeScoreDrift,
  createMatchRecord,
  deleteMatchRecord,
  editMatchRecord,
  loadMatches,
  loadPlayers,
  orderMatches,
  repairScoresFromLog,
  replayMatchLog,
  resetAllData,
  saveMatches,
  savePlayers,
  loserDelta,
  winnerDelta,
} from "./dataStore";
import type { Match, Player } from "./types";

function player(id: string, score: number, name = id): Player {
  return {
    id,
    name,
    club: null,
    score,
    initial_score: score,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function scoreOf(id: string): number {
  return loadPlayers().find((p) => p.id === id)!.score;
}

beforeEach(() => {
  // resetAllData() borra las claves y el store vuelve a los datos semilla,
  // así que después hay que dejar un almacén vacío y explícito.
  resetAllData();
  saveMatches([]);
});

describe("createMatchRecord", () => {
  it("intercambia los puntos del Art. 22 y guarda el antes y el después", () => {
    savePlayers([player("A", 1500), player("B", 1460)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 1);

    expect(newMatch.points_exchanged).toBe(7); // diff 40, gana el de mayor ranking
    expect(newMatch.winner_score_before).toBe(1500);
    expect(newMatch.winner_score_after).toBe(1507);
    expect(newMatch.loser_score_after).toBe(1453);
    expect(scoreOf("A")).toBe(1507);
    expect(scoreOf("B")).toBe(1453);
    expect(loadMatches()).toHaveLength(1);
  });

  it("no deja el puntaje del perdedor por debajo de cero", () => {
    savePlayers([player("A", 5), player("B", 6)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 0);

    expect(newMatch.points_exchanged).toBe(8);
    expect(scoreOf("B")).toBe(0);
    // el perdedor solo perdió 6, no los 8 del intercambio
    expect(loserDelta(newMatch)).toBe(6);
  });

  it("rechaza que un atleta juegue contra sí mismo", () => {
    savePlayers([player("A", 1500)]);
    expect(() => createMatchRecord("A", "A", 3, 0)).toThrow(/sí mismo/);
    expect(loadMatches()).toHaveLength(0);
  });

  it("rechaza jugadores inexistentes", () => {
    savePlayers([player("A", 1500)]);
    expect(() => createMatchRecord("A", "ZZ", 3, 0)).toThrow(/no encontrado/);
  });
});

describe("deleteMatchRecord", () => {
  it("devuelve los puntajes al estado anterior", () => {
    savePlayers([player("A", 1500), player("B", 1460)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 1);

    deleteMatchRecord(newMatch.id);

    expect(scoreOf("A")).toBe(1500);
    expect(scoreOf("B")).toBe(1460);
    expect(loadMatches()).toHaveLength(0);
  });

  it("no inventa puntos cuando el perdedor quedó en el piso 0", () => {
    savePlayers([player("A", 5), player("B", 6)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 0);

    deleteMatchRecord(newMatch.id);

    // antes del arreglo esto dejaba a B en 8 en lugar de 6
    expect(scoreOf("B")).toBe(6);
    expect(scoreOf("A")).toBe(5);
  });

  it("no hace nada si el partido no existe", () => {
    savePlayers([player("A", 1500)]);
    expect(deleteMatchRecord("no-existe").success).toBe(true);
    expect(scoreOf("A")).toBe(1500);
  });
});

describe("editMatchRecord", () => {
  it("corrige el ganador y recalcula los puntos de los dos", () => {
    savePlayers([player("A", 1500), player("B", 1460)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 1);
    expect(scoreOf("A")).toBe(1507);

    const { match } = editMatchRecord(newMatch.id, "B", "A", 3, 2);

    // vuelve A a 1500 y B a 1460, y ahora gana B (menor ranking, diff 40) → 10 pts
    expect(scoreOf("B")).toBe(1470);
    expect(scoreOf("A")).toBe(1490);
    expect(match.points_exchanged).toBe(10);
    expect(match.winner_id).toBe("B");
    expect(match.winner_score_before).toBe(1460);
  });

  it("no inventa puntos al revertir un partido con el perdedor en el piso 0", () => {
    savePlayers([player("A", 5), player("B", 6), player("C", 1000)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 0);
    expect(scoreOf("B")).toBe(0);

    // se corrige el resultado: ahora el ganador es C
    editMatchRecord(newMatch.id, "C", "A", 3, 0);

    // B tenía 6 y perdió solo 6: la reversión no puede devolverle los 8 del intercambio
    expect(scoreOf("B")).toBe(6);
  });

  it("rechaza un partido contra sí mismo", () => {
    savePlayers([player("A", 1500), player("B", 1500)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 0);
    expect(() => editMatchRecord(newMatch.id, "A", "A", 3, 0)).toThrow(/sí mismo/);
  });
});

describe("datos ya guardados", () => {
  it("los deltas reales salen del antes y el después del partido", () => {
    const match: Match = {
      id: "m1",
      played_at: "2026-01-01",
      winner_id: "A",
      loser_id: "B",
      winner_sets: 3,
      loser_sets: 0,
      winner_score_before: 100,
      loser_score_before: 6,
      winner_score_after: 132,
      loser_score_after: 0,
      points_exchanged: 32,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    expect(winnerDelta(match)).toBe(32);
    expect(loserDelta(match)).toBe(6);
  });

  it("ordena el log por fecha y después por fecha de alta", () => {
    const base = {
      winner_id: "A",
      loser_id: "B",
      winner_sets: 3,
      loser_sets: 0,
      winner_score_before: 0,
      loser_score_before: 0,
      winner_score_after: 0,
      loser_score_after: 0,
      points_exchanged: 0,
    };
    const matches: Match[] = [
      { ...base, id: "3", played_at: "2026-03-01", created_at: "2026-03-02T00:00:00Z" },
      { ...base, id: "1", played_at: "2026-01-01", created_at: "2026-01-02T00:00:00Z" },
      { ...base, id: "2", played_at: "2026-01-01", created_at: "2026-01-05T00:00:00Z" },
    ];
    expect(orderMatches(matches).map((m) => m.id)).toEqual(["1", "2", "3"]);
  });
});

describe("auditoría y reparación del historial", () => {
  it("no reporta desvío cuando el log explica los puntajes", () => {
    savePlayers([player("A", 5), player("B", 6)]);
    createMatchRecord("A", "B", 3, 0, "2026-01-01");

    const report = computeScoreDrift();

    expect(report.drift).toHaveLength(0);
    expect(report.matchesChanged).toBe(0);
    expect(report.playersInLog).toBe(2);
  });

  it("detecta un puntaje que el historial no explica", () => {
    savePlayers([player("A", 5), player("B", 6)]);
    createMatchRecord("A", "B", 3, 0, "2026-01-01");

    // simula el daño del bug viejo: al perdedor se le devolvieron 8 en lugar de 6
    savePlayers(loadPlayers().map((p) => (p.id === "B" ? { ...p, score: 8 } : p)));

    const report = computeScoreDrift();
    expect(report.drift).toHaveLength(1);
    expect(report.drift[0]).toMatchObject({ playerId: "B", stored: 8, expected: 0, diff: 8 });
    expect(report.maxDiff).toBe(8);
  });

  it("recalcula los puntajes y deja el historial coherente", () => {
    savePlayers([player("A", 5), player("B", 6)]);
    createMatchRecord("A", "B", 3, 0, "2026-01-01");
    savePlayers(loadPlayers().map((p) => (p.id === "B" ? { ...p, score: 8 } : p)));

    const applied = repairScoresFromLog();

    expect(applied.playersFixed).toBe(1);
    expect(scoreOf("B")).toBe(0);
    expect(scoreOf("A")).toBe(13);
    expect(computeScoreDrift().drift).toHaveLength(0);
  });

  it("reescribe el antes y el después de los partidos inconsistentes", () => {
    savePlayers([player("A", 1500), player("B", 1500)]);
    const { newMatch } = createMatchRecord("A", "B", 3, 0, "2026-01-01");
    // log corrupto: el partido dice que intercambiaron 32 puntos
    saveMatches(
      loadMatches().map((m) => ({
        ...m,
        winner_score_after: 1532,
        loser_score_after: 1468,
        points_exchanged: 32,
      })),
    );

    const report = computeScoreDrift();
    expect(report.matchesChanged).toBe(1);

    repairScoresFromLog();

    const fixed = loadMatches().find((m) => m.id === newMatch.id)!;
    expect(fixed.points_exchanged).toBe(8);
    expect(fixed.winner_score_before).toBe(1500);
    expect(fixed.loser_score_before).toBe(1500);
    expect(fixed.winner_score_after).toBe(1508);
    expect(fixed.loser_score_after).toBe(1492);
    expect(scoreOf("A")).toBe(1508);
    expect(computeScoreDrift().matchesChanged).toBe(0);
  });

  it("deja afuera a los atletas que no tienen partidos en el log", () => {
    // initial_score puede estar desactualizado: sin partidos, el puntaje no se toca
    savePlayers([player("A", 1500), { ...player("C", 1800), initial_score: 1200 }]);
    const replay = replayMatchLog(loadMatches(), loadPlayers());

    expect(replay.scores.has("C")).toBe(false);
    expect(computeScoreDrift().drift).toHaveLength(0);
    expect(scoreOf("C")).toBe(1800);
  });

  it("ignora partidos con atletas que ya no existen", () => {
    savePlayers([player("A", 1500), player("B", 1500)]);
    createMatchRecord("A", "B", 3, 0, "2026-01-01");
    savePlayers(loadPlayers().filter((p) => p.id !== "B"));

    const replay = replayMatchLog(loadMatches(), loadPlayers());

    expect(replay.matches).toHaveLength(0);
    expect(replay.scores.has("A")).toBe(false);
  });
});
