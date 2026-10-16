// Los tests corren en Node, donde no existe localStorage.
// El almacén de datos (src/lib/dataStore.ts) lo usa, así que acá va un doble simple.

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  writable: true,
  value: new MemoryStorage(),
});
