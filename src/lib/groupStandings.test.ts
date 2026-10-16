import { describe, expect, it } from "vitest";
import {
  computeGroupStandings,
  getQualifiersForKnockout,
} from "./groupStandings";
import type { TournamentMatch } from "./types";

function match(
  p1: string,
  p2: string,
  winner: string,
  s1: number,
  s2: number,
  group = "X",
): TournamentMatch {
  return {
    id: `m_${p1}_${p2}`,
    tournament_id: "t1",
    phase: "group",
    group_label: group,
    round: 1,
    match_number: 1,
    player1_id: p1,
    player2_id: p2,
    winner_id: winner,
    loser_id: winner === p1 ? p2 : p1,
    player1_sets: s1,
    player2_sets: s2,
    match_id: null,
    next_match_id: null,
    next_match_slot: null,
    next_match_loser_id: null,
    played_at: null,
    created_at: "",
    updated_at: "",
  };
}

const order = (standings: { playerId: string }[]) => standings.map((s) => s.playerId);

describe("computeGroupStandings", () => {
  it("ordena por victorias cuando no hay empate", () => {
    const matches = [
      match("A", "B", "A", 3, 0),
      match("A", "C", "A", 3, 1),
      match("B", "C", "B", 3, 2),
    ];
    const [group] = computeGroupStandings(matches);
    expect(order(group.standings)).toEqual(["A", "B", "C"]);
    expect(group.standings[0].wins).toBe(2);
    expect(group.standings[2].wins).toBe(0);
    expect(group.standings.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("arrastra los sets ganados y perdidos de cada atleta", () => {
    const matches = [match("A", "B", "A", 3, 1)];
    const [group] = computeGroupStandings(matches);
    const a = group.standings.find((s) => s.playerId === "A")!;
    const b = group.standings.find((s) => s.playerId === "B")!;
    expect(a.setsWon).toBe(3);
    expect(a.setsLost).toBe(1);
    expect(a.setsDiff).toBe(2);
    expect(b.setsWon).toBe(1);
    expect(b.setsLost).toBe(3);
    expect(b.setsDiff).toBe(-2);
  });

  it("resuelve el empate de dos por enfrentamiento directo", () => {
    const matches = [
      match("A", "B", "A", 3, 0), // A le gana a B
      match("B", "D", "B", 3, 0), // B suma su única victoria
      match("C", "A", "C", 3, 0), // C 2 victorias
      match("C", "D", "C", 3, 0),
    ];
    const [group] = computeGroupStandings(matches);
    // A y B empatan con 1 victoria, pero como A le ganó a B, A queda arriba de B
    expect(order(group.standings)).toEqual(["C", "A", "B", "D"]);
    expect(group.standings.map((s) => s.wins)).toEqual([2, 1, 1, 0]);
  });

  it("desempata la triple igualdad por ratio de sets", () => {
    const matches = [
      match("A", "B", "A", 3, 2),
      match("B", "C", "B", 3, 0),
      match("C", "A", "C", 3, 1),
    ];
    const [group] = computeGroupStandings(matches);
    // B: 5/3 = 1.67 · A: 4/5 = 0.8 · C: 3/4 = 0.75
    expect(order(group.standings)).toEqual(["B", "A", "C"]);
    expect(group.standings.map((s) => s.wins)).toEqual([1, 1, 1]);
  });

  it("si todo está igualado usa el Elo guardado como último criterio", () => {
    const matches = [
      match("X", "Y", "X", 3, 1, "G"),
      match("X", "Z", "Z", 1, 3, "G"),
      match("Y", "Z", "Y", 3, 1, "G"),
    ];
    const scores = new Map([
      ["X", 1500],
      ["Y", 1600],
      ["Z", 1550],
    ]);
    const [group] = computeGroupStandings(matches, scores);
    expect(order(group.standings)).toEqual(["Y", "Z", "X"]);
  });

  it("separa los grupos y deja afuera los atletas sin partidos jugados", () => {
    const matches = [
      match("A1", "A2", "A1", 3, 0, "A"),
      match("B1", "B2", "B2", 3, 2, "B"),
    ];
    const groups = computeGroupStandings(matches);
    expect(groups.map((g) => g.label)).toEqual(["A", "B"]);
    expect(order(groups[0].standings)).toEqual(["A1", "A2"]);
    expect(order(groups[1].standings)).toEqual(["B2", "B1"]);
  });

  it("no devuelve nada sin partidos", () => {
    expect(computeGroupStandings([])).toEqual([]);
  });
});

describe("getQualifiersForKnockout", () => {
  it("siembra por posición y alterna grupos: 1A, 1B, 2A, 2B", () => {
    const standings = computeGroupStandings([
      match("A1", "A2", "A1", 3, 0, "A"),
      match("B1", "B2", "B1", 3, 0, "B"),
    ]);
    const qualifiers = getQualifiersForKnockout(standings, 2);
    expect(qualifiers).toEqual(["A1", "B1", "A2", "B2"]);
  });

  it("no agrega posiciones que el grupo no tiene", () => {
    const standings = computeGroupStandings([match("A1", "A2", "A1", 3, 0, "A")]);
    expect(getQualifiersForKnockout(standings, 3)).toEqual(["A1", "A2"]);
  });
});
