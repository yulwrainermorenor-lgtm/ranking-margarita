import { describe, expect, it } from "vitest";
import { POINTS_TABLE, pointsForMatch } from "./points";

describe("pointsForMatch (Art. 22)", () => {
  it("devuelve 8 puntos cuando la diferencia es de hasta 24", () => {
    expect(pointsForMatch(1520, 1500)).toBe(8);
    expect(pointsForMatch(1500, 1524)).toBe(8);
  });

  it("respeta los cortes de la tabla en el límite exacto", () => {
    // 24 es la última diferencia que paga 8; 25 ya paga 7
    expect(pointsForMatch(1524, 1500)).toBe(8);
    expect(pointsForMatch(1525, 1500)).toBe(7);
    // 250 paga 1; 251 paga 0
    expect(pointsForMatch(1750, 1500)).toBe(1);
    expect(pointsForMatch(1751, 1500)).toBe(0);
  });

  it("paga más cuando gana el de menor ranking", () => {
    expect(pointsForMatch(1500, 1540)).toBe(10);
    expect(pointsForMatch(1500, 1580)).toBe(12);
    expect(pointsForMatch(1500, 1620)).toBe(15);
    expect(pointsForMatch(1500, 1680)).toBe(20);
    expect(pointsForMatch(1500, 1740)).toBe(26);
    expect(pointsForMatch(1500, 1800)).toBe(32);
  });

  it("no intercambia puntos si el de mayor ranking gana por más de 250", () => {
    expect(pointsForMatch(1800, 1500)).toBe(0);
  });

  it("trata como empate de ranking el caso de puntajes iguales", () => {
    expect(pointsForMatch(1500, 1500)).toBe(8);
  });

  it("la tabla mostrada en la UI tiene los mismos cortes que el cálculo", () => {
    const cortes = POINTS_TABLE.map((row) => row.range);
    expect(cortes).toHaveLength(7);
    // la última fila es la única sin tope
    expect(cortes[cortes.length - 1]).toContain("250");
  });
});
