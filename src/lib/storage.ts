/**
 * Capa de almacenamiento abstraída.
 *
 * Dato de negocio (jugadores, partidos, torneos) no debería vivir en
 * localStorage: es per-dispositivo y no se comparte entre navegadores.
 *
 * Esta interfaz permite cambiar el backend de almacenamiento (p. ej. a un
 * cliente real de Supabase) tocando solo este archivo, sin tocar dataStore
 * ni las páginas que lo consumen.
 *
 * Mientras no exista un Supabase real configurado (no hay
 * @supabase/supabase-js instalado ni URL/KEY de proyecto), se mantiene la
 * implementación sobre localStorage como fallback.
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements StorageAdapter {
  private get storage(): Storage | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  }

  getItem(key: string): string | null {
    const s = this.storage;
    if (!s) return null;
    try {
      return s.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    const s = this.storage;
    if (!s) return;
    try {
      s.setItem(key, value);
    } catch {
      // cuota excedida o modo privado: silenciar, no romper la app
    }
  }

  removeItem(key: string): void {
    const s = this.storage;
    if (!s) return;
    try {
      s.removeItem(key);
    } catch {
      // silenciar
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();

// ─── Helpers JSON ───

export function getJSON<T>(key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON<T>(key: string, value: T): void {
  storage.setItem(key, JSON.stringify(value));
}

export function removeJSON(key: string): void {
  storage.removeItem(key);
}
