type StorageAreaName = "local" | "session";

const memoryStorage: Record<StorageAreaName, Map<string, string>> = {
  local: new Map<string, string>(),
  session: new Map<string, string>(),
};

const getChromeStorageArea = (area: StorageAreaName) => {
  if (!globalThis.chrome?.storage) {
    return null;
  }

  if (area === "session") {
    return globalThis.chrome.storage.session ?? globalThis.chrome.storage.local ?? null;
  }

  return globalThis.chrome.storage.local ?? null;
};

const getWebStorageArea = (area: StorageAreaName) => {
  if (typeof window === "undefined") {
    return null;
  }

  if (area === "session" && "sessionStorage" in window) {
    return window.sessionStorage;
  }

  if (area === "local" && "localStorage" in window) {
    return window.localStorage;
  }

  return null;
};

const getMemoryArea = (area: StorageAreaName) => memoryStorage[area];

export const getStorageItem = async (key: string, area: StorageAreaName = "local") => {
  const chromeStorage = getChromeStorageArea(area);
  const webStorage = getWebStorageArea(area);

  if (chromeStorage) {
    const result = await chromeStorage.get(key);
    if (typeof result[key] === "string") {
      return result[key];
    }

    // Migrate legacy browser storage into extension storage the first time we
    // touch a key after the storage hardening change.
    if (area === "local" && webStorage) {
      const legacyValue = webStorage.getItem(key);
      if (legacyValue !== null) {
        await chromeStorage.set({ [key]: legacyValue });
        return legacyValue;
      }
    }

    return null;
  }

  if (webStorage) {
    return webStorage.getItem(key);
  }

  return getMemoryArea(area).get(key) ?? null;
};

export const setStorageItem = async (key: string, value: string, area: StorageAreaName = "local") => {
  const chromeStorage = getChromeStorageArea(area);
  if (chromeStorage) {
    await chromeStorage.set({ [key]: value });
    return;
  }

  const webStorage = getWebStorageArea(area);
  if (webStorage) {
    webStorage.setItem(key, value);
    return;
  }

  getMemoryArea(area).set(key, value);
};

export const removeStorageItem = async (key: string, area: StorageAreaName = "local") => {
  const chromeStorage = getChromeStorageArea(area);
  if (chromeStorage) {
    await chromeStorage.remove(key);
    return;
  }

  const webStorage = getWebStorageArea(area);
  if (webStorage) {
    webStorage.removeItem(key);
    return;
  }

  getMemoryArea(area).delete(key);
};

export const listStorageKeys = async (area: StorageAreaName = "local") => {
  const chromeStorage = getChromeStorageArea(area);
  if (chromeStorage) {
    const result = await chromeStorage.get(null);
    return Object.keys(result);
  }

  const webStorage = getWebStorageArea(area);
  if (webStorage) {
    return Array.from({ length: webStorage.length }, (_, index) => webStorage.key(index)).filter(
      (key): key is string => Boolean(key),
    );
  }

  return [...getMemoryArea(area).keys()];
};

export const removeStorageItemsWithPrefix = async (prefix: string, area: StorageAreaName = "local") => {
  const keys = await listStorageKeys(area);
  const matching = keys.filter((key) => key.startsWith(prefix));

  await Promise.all(matching.map((key) => removeStorageItem(key, area)));
};
