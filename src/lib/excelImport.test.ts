import { describe, expect, it } from "vitest";
import {
  matchKey,
  norm,
  parseDate,
  parseMatchRows,
  parseNumber,
  parsePlayerRows,
  parseTruthy,
  validateMatchRow,
} from "./excelImport";

describe("parseNumber", () => {
  it("devuelve NaN en una celda vacía, no 0", () => {
    // con 0, importar una planilla sin puntaje dejaba a todos los atletas en 0
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("   ")).toBeNaN();
    expect(parseNumber(null)).toBeNaN();
    expect(parseNumber(undefined)).toBeNaN();
  });

  it("lee números con coma decimal y con espacios", () => {
    expect(parseNumber("1894")).toBe(1894);
    expect(parseNumber(" 1500 ")).toBe(1500);
    expect(parseNumber("1745,5")).toBe(1745.5);
    expect(parseNumber(1600)).toBe(1600);
  });

  it("devuelve NaN si la celda trae texto", () => {
    expect(parseNumber("sin dato")).toBeNaN();
  });
});

describe("parseDate", () => {
  it("acepta el formato ISO", () => {
    expect(parseDate("2026-09-15")).toBe("2026-09-15");
  });

  it("acepta día/mes/año y lo normaliza", () => {
    expect(parseDate("5/9/2026")).toBe("2026-09-05");
    expect(parseDate("15-09-2026")).toBe("2026-09-15");
  });

  it("devuelve null si no puede leerla (no inventa la fecha de hoy)", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("septiembre")).toBeNull();
    expect(parseDate("32/13/2026")).toBeNull();
    expect(parseDate(null)).toBeNull();
  });

  it("lee fechas nativas de Excel", () => {
    expect(parseDate(new Date("2026-09-15T00:00:00.000Z"))).toBe("2026-09-15");
  });
});

describe("parseTruthy", () => {
  it("trata la celda vacía como activo", () => {
    expect(parseTruthy("")).toBe(true);
    expect(parseTruthy(undefined)).toBe(true);
  });

  it("reconoce las formas de decir que sí", () => {
    for (const v of ["si", "Sí", "SI", "true", "1", "x", "yes", "activo"]) {
      expect(parseTruthy(v)).toBe(true);
    }
  });

  it("reconoce el no", () => {
    expect(parseTruthy("no")).toBe(false);
    expect(parseTruthy("false")).toBe(false);
    expect(parseTruthy("0")).toBe(false);
  });
});

describe("parsePlayerRows", () => {
  it("deja el puntaje en null cuando la celda está vacía", () => {
    const [row] = parsePlayerRows([{ nombre: "Ana", club: "Porlamar", puntaje: "", puntaje_inicial: "", activo: "si" }]);
    expect(row).toMatchObject({
      name: "Ana",
      club: "Porlamar",
      score: null,
      initialScore: null,
      isActive: true,
      rowNumber: 2,
    });
  });

  it("saltea las filas sin nombre y numera como en la planilla", () => {
    const rows = parsePlayerRows([
      { nombre: "" },
      { nombre: "Beto", puntaje: 1500 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(3);
  });

  it("normaliza encabezados con acentos y mayúsculas", () => {
    expect(norm("Puntaje Inicial")).toBe("puntaje inicial");
    expect(norm("Ganador")).toBe("ganador");
    expect(norm("Sí")).toBe("si");
  });
});

describe("parseMatchRows y validateMatchRow", () => {
  const valid = {
    fecha: "2026-09-15",
    ganador: "Juan Pérez",
    perdedor: "Ana Gómez",
    sets_ganador: 3,
    sets_perdedor: 1,
  };

  it("lee una fila correcta", () => {
    const [row] = parseMatchRows([valid]);
    expect(row).toMatchObject({
      winnerName: "Juan Pérez",
      loserName: "Ana Gómez",
      winnerSets: 3,
      loserSets: 1,
      playedAt: "2026-09-15",
      rowNumber: 2,
    });
    expect(validateMatchRow(row)).toBeNull();
  });

  it("rechaza la fecha vacía en lugar de cargar el partido hoy", () => {
    const [row] = parseMatchRows([{ ...valid, fecha: "" }]);
    expect(row.playedAt).toBeNull();
    expect(validateMatchRow(row)).toMatch(/fecha/);
  });

  it("rechaza sets invertidos", () => {
    const [row] = parseMatchRows([{ ...valid, sets_ganador: 1, sets_perdedor: 3 }]);
    expect(validateMatchRow(row)).toMatch(/más sets/);
  });

  it("rechaza un partido del atleta contra sí mismo", () => {
    const [row] = parseMatchRows([{ ...valid, perdedor: "juan perez" }]);
    expect(validateMatchRow(row)).toMatch(/mismo atleta/);
  });

  it("mantiene un 0 legítimo en los sets", () => {
    const [row] = parseMatchRows([{ ...valid, sets_perdedor: 0 }]);
    expect(row.loserSets).toBe(0);
    expect(validateMatchRow(row)).toBeNull();
  });

  it("saltea filas completamente vacías", () => {
    expect(parseMatchRows([{ ganador: "", perdedor: "" }])).toHaveLength(0);
  });
});

describe("matchKey", () => {
  it("genera la misma clave para el mismo partido", () => {
    expect(matchKey("A", "B", "2026-09-15")).toBe(matchKey("A", "B", "2026-09-15"));
  });

  it("distingue partidos distintos", () => {
    expect(matchKey("A", "B", "2026-09-15")).not.toBe(matchKey("A", "B", "2026-09-16"));
    expect(matchKey("A", "B", "2026-09-15")).not.toBe(matchKey("B", "A", "2026-09-15"));
  });
});
