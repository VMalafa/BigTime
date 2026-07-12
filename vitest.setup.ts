// The flow store uses zustand's persist middleware, which expects a Storage
// implementation. Node has none, so provide an in-memory one to keep tests
// quiet and deterministic.
const memory = new Map<string, string>();

const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key) => memory.get(key) ?? null,
  key: (index) => [...memory.keys()][index] ?? null,
  removeItem: (key) => {
    memory.delete(key);
  },
  setItem: (key, value) => {
    memory.set(key, value);
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: memoryStorage,
  writable: true,
});
