// Parseo y validación de las planillas Excel de importación.
// Vive aparte de la pantalla para poder probarlo sin navegador.

export const PLAYER_COLS = ["nombre", "club", "puntaje", "puntaje_inicial", "activo"];
export const MATCH_COLS = ["fecha", "ganador", "perdedor", "sets_ganador", "sets_perdedor"];

/** Normaliza un encabezado o un valor: sin acentos, en minúsculas y sin espacios. */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Lee un número de una celda.
 * Una celda vacía devuelve NaN, no 0: si devolviéramos 0, importar una planilla
 * sin la columna `puntaje` dejaría en 0 el Elo de todos los atletas existentes.
 */
export function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const raw = String(value).trim();
  if (raw === "") return NaN;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Lee una fecha y la devuelve como `YYYY-MM-DD`. Devuelve null si no se puede leer. */
export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** Columna "activo": vacío = activo, igual que antes. */
export function parseTruthy(value: unknown): boolean {
  const s = norm(String(value ?? ""));
  if (!s) return true;
  return ["si", "true", "1", "activo", "x", "yes"].includes(s);
}

export type PlayerRow = {
  rowNumber: number;
  name: string;
  club: string | null;
  score: number | null;
  initialScore: number | null;
  isActive: boolean;
};

export type MatchRow = {
  rowNumber: number;
  winnerName: string;
  loserName: string;
  winnerSets: number;
  loserSets: number;
  playedAt: string | null;
};

function cell(row: Record<string, unknown>, column: string): unknown {
  return row[column];
}

/** Convierte las filas crudas de la planilla de atletas en filas validadas. */
export function parsePlayerRows(rows: Record<string, unknown>[]): PlayerRow[] {
  const out: PlayerRow[] = [];
  rows.forEach((row, index) => {
    const name = String(cell(row, "nombre") ?? "").trim();
    if (!name) return;
    const score = parseNumber(cell(row, "puntaje"));
    const initialScore = parseNumber(cell(row, "puntaje_inicial"));
    out.push({
      rowNumber: index + 2,
      name,
      club: String(cell(row, "club") ?? "").trim() || null,
      score: Number.isFinite(score) ? score : null,
      initialScore: Number.isFinite(initialScore) ? initialScore : null,
      isActive: parseTruthy(cell(row, "activo")),
    });
  });
  return out;
}

/** Convierte las filas crudas de la planilla de partidos en filas validadas. */
export function parseMatchRows(rows: Record<string, unknown>[]): MatchRow[] {
  const out: MatchRow[] = [];
  rows.forEach((row, index) => {
    const winnerName = String(cell(row, "ganador") ?? "").trim();
    const loserName = String(cell(row, "perdedor") ?? "").trim();
    if (!winnerName && !loserName) return;
    const winnerSetsRaw = parseNumber(cell(row, "sets_ganador"));
    const loserSetsRaw = parseNumber(cell(row, "sets_perdedor"));
    out.push({
      rowNumber: index + 2,
      winnerName,
      loserName,
      winnerSets: Number.isFinite(winnerSetsRaw) ? winnerSetsRaw : 3,
      loserSets: Number.isFinite(loserSetsRaw) ? loserSetsRaw : 0,
      playedAt: parseDate(cell(row, "fecha")),
    });
  });
  return out;
}

/**
 * Valida una fila de partido. Devuelve el motivo del rechazo o null si está bien.
 * Un partido sin fecha verificable o con sets invertidos no se carga: adivinar
 * la fecha o los sets ensucia el historial.
 */
export function validateMatchRow(row: MatchRow): string | null {
  if (!row.winnerName || !row.loserName) return "falta ganador o perdedor";
  if (norm(row.winnerName) === norm(row.loserName)) return "ganador y perdedor son el mismo atleta";
  if (!row.playedAt) return "fecha vacía o inválida";
  if (row.winnerSets <= row.loserSets) return "el ganador debe tener más sets";
  return null;
}

/** Clave para no cargar dos veces el mismo partido (atletas + fecha). */
export function matchKey(winnerId: string, loserId: string, playedAt: string): string {
  return `${winnerId}|${loserId}|${playedAt}`;
}
