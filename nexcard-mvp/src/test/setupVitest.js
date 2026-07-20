import { vi } from 'vitest';

globalThis.jest = vi;

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
};

const memoryStorage = createMemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
});

if (globalThis.window) {
  Object.defineProperty(globalThis.window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  });
}
