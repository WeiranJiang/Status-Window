const memoryStorage = new Map<string, string>();

const hasLocalStorage = () => typeof window !== "undefined" && "localStorage" in window;

export const getStorageItem = async (key: string) => {
  if (hasLocalStorage()) {
    return window.localStorage.getItem(key);
  }

  return memoryStorage.get(key) ?? null;
};

export const setStorageItem = async (key: string, value: string) => {
  if (hasLocalStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }

  memoryStorage.set(key, value);
};

export const removeStorageItem = async (key: string) => {
  if (hasLocalStorage()) {
    window.localStorage.removeItem(key);
    return;
  }

  memoryStorage.delete(key);
};
