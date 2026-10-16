import {
  loadPlayers,
  savePlayers,
  loadMatches,
  saveMatches,
  loadTournaments,
  saveTournaments,
  loadTournamentMatches,
  saveTournamentMatches,
  loadTournamentParticipants,
  saveTournamentParticipants,
  createMatchRecord,
  deleteMatchRecord,
  editMatchRecord,
} from "@/lib/dataStore";
import { Player, Match, Tournament, TournamentMatch, TournamentParticipant } from "@/lib/types";

function getSourceData(tableName: string): any[] {
  if (tableName === "players") return loadPlayers();
  if (tableName === "matches") return loadMatches();
  if (tableName === "tournaments") return loadTournaments();
  if (tableName === "tournament_matches") return loadTournamentMatches();
  if (tableName === "tournament_participants") return loadTournamentParticipants();
  return [];
}

function saveSourceData(tableName: string, data: any[]) {
  if (tableName === "players") savePlayers(data);
  else if (tableName === "matches") saveMatches(data);
  else if (tableName === "tournaments") saveTournaments(data);
  else if (tableName === "tournament_matches") saveTournamentMatches(data);
  else if (tableName === "tournament_participants") saveTournamentParticipants(data);
}

class MockMutationBuilder {
  private tableName: string;
  private action: "update" | "delete";
  private payload: any;
  private filters: Array<{ field: string; value: any }> = [];

  constructor(tableName: string, action: "update" | "delete", payload?: any) {
    this.tableName = tableName;
    this.action = action;
    this.payload = payload;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, value });
    return this;
  }

  private execute(): Promise<{ data: any; error: any }> {
    return new Promise((resolve) => {
      const items = getSourceData(this.tableName);

      if (this.action === "update") {
        let updatedCount = 0;
        const next = items.map((item) => {
          const matches = this.filters.every(
            (f) => String(item[f.field]) === String(f.value)
          );
          if (matches) {
            updatedCount++;
            return {
              ...item,
              ...this.payload,
              updated_at: item.updated_at ? new Date().toISOString() : undefined,
            };
          }
          return item;
        });
        saveSourceData(this.tableName, next);
        resolve({ data: updatedCount > 0 ? this.payload : null, error: null });
      } else if (this.action === "delete") {
        const next = items.filter(
          (item) =>
            !this.filters.every(
              (f) => String(item[f.field]) === String(f.value)
            )
        );
        saveSourceData(this.tableName, next);
        resolve({ data: null, error: null });
      }
    });
  }

  then<T>(
    onfulfilled?: ((value: { data: any; error: any }) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: any) => T | PromiseLike<T>) | null
  ): Promise<T> {
    return this.execute().then(onfulfilled, onrejected) as Promise<T>;
  }

  catch<T>(onrejected?: ((reason: any) => T | PromiseLike<T>) | null): Promise<T> {
    return this.execute().catch(onrejected) as Promise<T>;
  }

  finally(onfinally?: (() => void) | null): Promise<any> {
    return this.execute().finally(onfinally);
  }
}

class MockInsertBuilder {
  private tableName: string;
  private data: any;
  private isSingle: boolean = false;

  constructor(tableName: string, data: any) {
    this.tableName = tableName;
    this.data = data;
  }

  select(_fields: string = "*") {
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  private execute(): Promise<{ data: any; error: any }> {
    return new Promise((resolve) => {
      const items = Array.isArray(this.data) ? this.data : [this.data];
      const current = getSourceData(this.tableName);
      const generated = items.map((it) => ({
        id:
          it.id ||
          (crypto.randomUUID
            ? crypto.randomUUID()
            : `${this.tableName.slice(0, 3)}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 6)}`),
        created_at: it.created_at || new Date().toISOString(),
        updated_at: it.updated_at || new Date().toISOString(),
        ...it,
      }));

      saveSourceData(this.tableName, [...current, ...generated]);
      const resultData = this.isSingle ? (generated.length > 0 ? generated[0] : null) : generated;
      resolve({ data: resultData, error: null });
    });
  }

  then<T>(
    onfulfilled?: ((value: { data: any; error: any }) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: any) => T | PromiseLike<T>) | null
  ): Promise<T> {
    return this.execute().then(onfulfilled, onrejected) as Promise<T>;
  }

  catch<T>(onrejected?: ((reason: any) => T | PromiseLike<T>) | null): Promise<T> {
    return this.execute().catch(onrejected) as Promise<T>;
  }

  finally(onfinally?: (() => void) | null): Promise<any> {
    return this.execute().finally(onfinally);
  }
}

// Static mock implementation of Supabase Query Builder for Cloudflare Pages static hosting
class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderFields: Array<{ field: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private limitNum: number | null = null;
  private selectFields: string = "*";
  private isCount: boolean = false;
  private isHead: boolean = false;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields: string = "*", options?: { count?: string; head?: boolean }) {
    this.selectFields = fields;
    if (options?.count) this.isCount = true;
    if (options?.head) this.isHead = true;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((item) => String(item[field]) === String(value));
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push((item) => String(item[field]) !== String(value));
    return this;
  }

  in(field: string, values: any[]) {
    const stringVals = values.map((v) => String(v));
    this.filters.push((item) => stringVals.includes(String(item[field])));
    return this;
  }

  or(filterStr: string) {
    const clauses = filterStr.split(",");
    this.filters.push((item) => {
      return clauses.some((clause) => {
        const parts = clause.trim().split(".eq.");
        if (parts.length === 2) {
          const [f, val] = parts;
          return String(item[f]) === String(val);
        }
        return false;
      });
    });
    return this;
  }

  order(field: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.orderFields.push({
      field,
      ascending: options.ascending !== false,
      nullsFirst: options.nullsFirst,
    });
    return this;
  }

  limit(num: number) {
    this.limitNum = num;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: any) {
    return new MockInsertBuilder(this.tableName, data);
  }

  upsert(data: any) {
    return new MockInsertBuilder(this.tableName, data);
  }

  update(data: any) {
    return new MockMutationBuilder(this.tableName, "update", data);
  }

  delete() {
    return new MockMutationBuilder(this.tableName, "delete");
  }

  // Execute the query and return a real Promise
  private execute(): Promise<{ data: any; error: any; count?: number }> {
    return new Promise((resolve) => {
      const sourceData: any[] = getSourceData(this.tableName);

      let result = sourceData.filter((item) => this.filters.every((f) => f(item)));

      // Apply sorting
      if (this.orderFields.length > 0) {
        result.sort((a, b) => {
          for (const order of this.orderFields) {
            const valA = a[order.field];
            const valB = b[order.field];
            if (valA !== valB) {
              if (valA == null) return order.nullsFirst ? -1 : 1;
              if (valB == null) return order.nullsFirst ? 1 : -1;
              if (valA < valB) return order.ascending ? -1 : 1;
              if (valA > valB) return order.ascending ? 1 : -1;
            }
          }
          return 0;
        });
      }

      const totalCount = result.length;

      if (this.limitNum !== null) {
        result = result.slice(0, this.limitNum);
      }

      if (this.isHead) {
        resolve({ data: null, error: null, count: totalCount });
        return;
      }

      if (this.isSingle || this.isMaybeSingle) {
        const singleItem = result.length > 0 ? result[0] : null;
        resolve({ data: singleItem, error: null, count: result.length });
        return;
      }

      resolve({ data: result, error: null, count: totalCount });
    });
  }

  // Make this a proper thenable/Promise so `await` works
  then<T>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => T | PromiseLike<T>) | null,
    onrejected?: ((reason: any) => T | PromiseLike<T>) | null
  ): Promise<T> {
    return this.execute().then(onfulfilled, onrejected) as Promise<T>;
  }

  catch<T>(onrejected?: ((reason: any) => T | PromiseLike<T>) | null): Promise<T> {
    return this.execute().catch(onrejected) as Promise<T>;
  }

  finally(onfinally?: (() => void) | null): Promise<any> {
    return this.execute().finally(onfinally);
  }
}

export const supabase = {
  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async (credentials?: any) => ({
      data: { user: { id: "admin", email: credentials?.email || "admin@example.com" } },
      error: null,
    }),
    signOut: async () => ({ error: null }),
  },
  functions: {
    invoke: async (functionName: string, options?: { body?: any }): Promise<{ data: any; error: any }> => {
      if (functionName === "record-match" && options?.body) {
        const { winner_id, loser_id, winner_sets, loser_sets, played_at } = options.body;
        try {
          const res = createMatchRecord(
            winner_id,
            loser_id,
            Number(winner_sets || 3),
            Number(loser_sets || 0),
            played_at
          );
          return {
            data: {
              success: true,
              match: res.newMatch,
              match_id: res.newMatch.id,
              delta: res.newMatch.points_exchanged,
              error: null,
            },
            error: null,
          };
        } catch (err: any) {
          return { data: { error: err.message, success: false }, error: null };
        }
      }
      if (functionName === "delete-match" && options?.body) {
        const { match_id } = options.body;
        try {
          deleteMatchRecord(match_id);
          return { data: { success: true, error: null }, error: null };
        } catch (err: any) {
          return { data: { error: err.message, success: false }, error: null };
        }
      }
      if (functionName === "edit-match" && options?.body) {
        const { match_id, winner_id, loser_id, winner_sets, loser_sets, played_at } = options.body;
        try {
          const res = editMatchRecord(
            match_id,
            winner_id,
            loser_id,
            Number(winner_sets || 3),
            Number(loser_sets || 0),
            played_at
          );
          return {
            data: {
              success: true,
              match: res.match,
              match_id: res.match.id,
              delta: res.match.points_exchanged,
              error: null,
            },
            error: null,
          };
        } catch (err: any) {
          return { data: { error: err.message, success: false }, error: null };
        }
      }
      if (functionName === "sync-all" || functionName === "sync-sheets") {
        return { data: { imported: 0, updated: 0, error: null }, error: null };
      }
      return { data: { success: true, error: null }, error: null };
    },
  },
};