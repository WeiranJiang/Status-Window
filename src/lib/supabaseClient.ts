import { createClient } from "@supabase/supabase-js";
import { getStorageItem, removeStorageItem, setStorageItem } from "./storage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseAuthCallbackUrl = new URL(
  "/auth/v1/callback",
  supabaseUrl || "https://example.supabase.co",
).toString();

const storageAdapter = {
  getItem: (key: string) => getStorageItem(key, "session"),
  setItem: (key: string, value: string) => setStorageItem(key, value, "session"),
  removeItem: (key: string) => removeStorageItem(key, "session"),
};

export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "demo-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: storageAdapter,
  },
});
