import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MATCH_COLS,
  PLAYER_COLS,
  matchKey,
  norm,
  parseMatchRows,
  parsePlayerRows,
  validateMatchRow,
} from "@/lib/excelImport";
import { loadMatches } from "@/lib/dataStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, FileSpreadsheet, Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function downloadTemplate(kind: "jugadores" | "partidos") {
  const rows =
    kind === "jugadores"
      ? [
          PLAYER_COLS,
          ["Juan Pérez", "Club Margarita", 1894, 1894, "si"],
          ["Ana Gómez", "Club Porlamar", 1750, 1750, "no"],
        ]
      : [
          MATCH_COLS,
          ["2026-09-15", "Juan Pérez", "Ana Gómez", 3, 1],
          ["2026-09-16", "Ana Gómez", "Juan Pérez", 3, 2],
        ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = rows[0].map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, kind);
  XLSX.writeFile(wb, `plantilla-${kind}.xlsx`);
}

async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });
  return raw.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[norm(k)] = v;
    return out;
  });
}

export default function ImportData() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const { data: players } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, club, score, initial_score, is_active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const byName = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    (players ?? []).forEach((p) => m.set(norm(p.name), p));
    return m;
  }, [players]);

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-zinc-400">
        Esta sección está reservada para administración de datos.
      </div>
    );
  }

  async function handlePlayers(file: File) {
    setBusy(true);
    setLog([]);
    const lines: string[] = [];
    try {
      const rows = await readSheet(file);
      const parsed = parsePlayerRows(rows);
      let inserted = 0;
      let updated = 0;
      for (const r of parsed) {
        const existing = byName.get(norm(r.name));
        const payload: {
          club: string | null;
          is_active: boolean;
          score?: number;
          initial_score?: number;
        } = { club: r.club, is_active: r.isActive };
        // solo se pisa el puntaje si la planilla trae un número real
        if (r.score !== null) payload.score = r.score;
        if (r.initialScore !== null) payload.initial_score = r.initialScore;
        if (existing) {
          const { error } = await supabase
            .from("players")
            .update(payload)
            .eq("id", existing.id);
          if (error) lines.push(`Fila ${r.rowNumber} (${r.name}): ${error.message}`);
          else updated++;
        } else {
          const { error } = await supabase.from("players").insert({
            name: r.name,
            club: r.club,
            is_active: r.isActive,
            score: r.score ?? 1500,
            initial_score: r.initialScore ?? r.score ?? 1500,
          });
          if (error) lines.push(`Fila ${r.rowNumber} (${r.name}): ${error.message}`);
          else inserted++;
        }
      }
      lines.unshift(`Agregados: ${inserted} · Actualizados: ${updated}`);
      toast.success(`Jugadores: ${inserted} nuevos, ${updated} actualizados`);
      qc.invalidateQueries({ queryKey: ["players"] });
    } catch (e) {
      lines.push(e instanceof Error ? e.message : "Error leyendo el archivo");
      toast.error("No se pudo importar");
    } finally {
      setLog(lines);
      setBusy(false);
    }
  }

  async function handleMatches(file: File) {
    setBusy(true);
    setLog([]);
    const lines: string[] = [];
    try {
      const rows = await readSheet(file);
      const parsed = parseMatchRows(rows);
      const { data: fresh } = await supabase.from("players").select("id, name");
      const map = new Map<string, string>();
      (fresh ?? []).forEach((p) => map.set(norm(p.name), p.id));

      // Los partidos ya cargados no se vuelven a aplicar: subir dos veces la misma
      // planilla duplicaba el historial y sumaba los puntos otra vez.
      const alreadyLoaded = new Set(
        loadMatches().map((m) => matchKey(m.winner_id, m.loser_id, m.played_at)),
      );

      // El puntaje de un partido depende del puntaje del momento, así que hay que
      // cargarlos en orden de fecha y no en el orden en que vengan en el archivo.
      const ordered = [...parsed].sort((a, b) =>
        String(a.playedAt ?? "").localeCompare(String(b.playedAt ?? "")),
      );

      let ok = 0;
      for (const r of ordered) {
        const invalid = validateMatchRow(r);
        if (invalid) {
          lines.push(`Fila ${r.rowNumber}: ${invalid}`);
          continue;
        }
        const wid = map.get(norm(r.winnerName));
        const lid = map.get(norm(r.loserName));
        if (!wid || !lid) {
          lines.push(
            `Fila ${r.rowNumber}: jugador no encontrado (${!wid ? r.winnerName : r.loserName})`,
          );
          continue;
        }
        const key = matchKey(wid, lid, r.playedAt!);
        if (alreadyLoaded.has(key)) {
          lines.push(`Fila ${r.rowNumber}: partido ya cargado (${r.playedAt})`);
          continue;
        }
        const { data, error } = await supabase.functions.invoke(
          "record-match",
          {
            body: {
              winner_id: wid,
              loser_id: lid,
              winner_sets: r.winnerSets,
              loser_sets: r.loserSets,
              played_at: r.playedAt,
            },
          },
        );
        const errMsg =
          (data as { error?: unknown } | null)?.error ?? error?.message;
        if (errMsg) {
          lines.push(`Fila ${r.rowNumber}: ${JSON.stringify(errMsg)}`);
        } else {
          alreadyLoaded.add(key);
          ok++;
        }
      }
      lines.unshift(`Partidos cargados: ${ok} de ${rows.length}`);
      toast.success(`${ok} partidos cargados`);
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      lines.push(e instanceof Error ? e.message : "Error leyendo el archivo");
      toast.error("No se pudo importar");
    } finally {
      setLog(lines);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 border border-white/10 p-5 md:p-6 rounded-2xl">
        <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">
          Importar / Exportar <span className="text-red-500">Excel</span>
        </h1>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">
          Carga masiva de atletas y resultados desde archivos .xlsx o .csv
        </p>
      </div>

      <Tabs defaultValue="jugadores" className="w-full">
        <TabsList className="grid grid-cols-2 w-full bg-zinc-900 p-1 border border-white/10 rounded-xl">
          <TabsTrigger value="jugadores" className="data-[state=active]:bg-red-600 data-[state=active]:text-white font-bold text-xs rounded-lg">
            Jugadores / Atletas
          </TabsTrigger>
          <TabsTrigger value="partidos" className="data-[state=active]:bg-red-600 data-[state=active]:text-white font-bold text-xs rounded-lg">
            Historial de Partidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jugadores" className="mt-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <FileSpreadsheet className="h-5 w-5 text-red-500" /> Formato de atletas
            </div>
            <p className="text-xs text-zinc-400">
              Primera fila con los encabezados exactos en español. Si el nombre del atleta ya existe, se actualiza su puntaje y club.
            </p>

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-white/10">
                  <tr>
                    {PLAYER_COLS.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-bold uppercase">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-200 font-mono">
                  <tr>
                    <td className="px-3 py-2 font-sans font-medium text-white">Juan Pérez</td>
                    <td className="px-3 py-2 font-sans">Club Margarita</td>
                    <td className="px-3 py-2">1894</td>
                    <td className="px-3 py-2">1894</td>
                    <td className="px-3 py-2">si</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-white/15 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs gap-1.5 rounded-xl font-medium"
                onClick={() => downloadTemplate("jugadores")}
              >
                <Download className="h-4 w-4 text-red-500" /> Descargar Plantilla
              </Button>

              <label>
                <Button size="sm" className="h-9 bg-red-600 hover:bg-red-500 text-white text-xs gap-1.5 rounded-xl font-bold shadow-glow-red" disabled={busy}>
                  <Upload className="h-4 w-4" />
                  {busy ? "Procesando..." : "Subir Archivo Excel"}
                </Button>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) handlePlayers(f);
                  }}
                />
              </label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="partidos" className="mt-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <FileSpreadsheet className="h-5 w-5 text-red-500" /> Formato de partidos
            </div>
            <p className="text-xs text-zinc-400">
              Cada fila del archivo cargará un partido oficial y recalculará automáticamente los puntos según el Reglamento Nueva Esparta (art. 22).
            </p>

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-white/10">
                  <tr>
                    {MATCH_COLS.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-bold uppercase">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-200 font-mono">
                  <tr>
                    <td className="px-3 py-2">2026-09-15</td>
                    <td className="px-3 py-2 font-sans font-medium text-white">Juan Pérez</td>
                    <td className="px-3 py-2 font-sans">Ana Gómez</td>
                    <td className="px-3 py-2">3</td>
                    <td className="px-3 py-2">1</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-white/15 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs gap-1.5 rounded-xl font-medium"
                onClick={() => downloadTemplate("partidos")}
              >
                <Download className="h-4 w-4 text-red-500" /> Descargar Plantilla
              </Button>

              <label>
                <Button size="sm" className="h-9 bg-red-600 hover:bg-red-500 text-white text-xs gap-1.5 rounded-xl font-bold shadow-glow-red" disabled={busy}>
                  <Upload className="h-4 w-4" />
                  {busy ? "Procesando..." : "Subir Archivo Excel"}
                </Button>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) handleMatches(f);
                  }}
                />
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Result Log */}
      {log.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 space-y-2">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-red-500" /> Resultado del Proceso
          </h3>
          <ul className="text-xs font-mono space-y-1">
            {log.map((l, i) => (
              <li key={i} className={i === 0 ? "text-emerald-400 font-bold" : "text-red-400 flex items-center gap-1"}>
                {i > 0 && <AlertCircle className="h-3 w-3 shrink-0" />} {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
