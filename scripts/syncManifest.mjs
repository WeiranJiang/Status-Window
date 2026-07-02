import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnv } from "vite";

const DEFAULT_SUPABASE_URL = "https://example.supabase.co";
const rootDir = resolve(import.meta.dirname, "..");
const mode = process.argv[2] || process.env.NODE_ENV || "development";
const env = loadEnv(mode, rootDir, "");

const configuredSupabaseUrl = env.VITE_SUPABASE_URL?.trim();

let supabaseOrigin = DEFAULT_SUPABASE_URL;

if (configuredSupabaseUrl) {
  try {
    supabaseOrigin = new URL(configuredSupabaseUrl).origin;
  } catch (error) {
    throw new Error(
      `VITE_SUPABASE_URL must be a valid absolute URL. Received: ${configuredSupabaseUrl}`,
      { cause: error },
    );
  }
}

const supabaseWebsocketOrigin = supabaseOrigin.replace(/^http/i, "ws");

const createManifest = ({ built }) => ({
  manifest_version: 3,
  name: "Status Window",
  description: "A study timer and session tracker with stats and optional cloud sync.",
  version: "0.1.0",
  action: {
    default_title: "Status Window",
    default_popup: built ? "popup.html" : "dist/popup.html",
  },
  background: {
    service_worker: built ? "background.js" : "dist/background.js",
    type: "module",
  },
  side_panel: {
    default_path: built ? "sidepanel.html" : "dist/sidepanel.html",
  },
  permissions: ["storage", "identity", "alarms", "sidePanel", "offscreen"],
  host_permissions: [`${supabaseOrigin}/*`],
  icons: {
    16: built ? "icons/icon-16.png" : "dist/icons/icon-16.png",
    32: built ? "icons/icon-32.png" : "dist/icons/icon-32.png",
    48: built ? "icons/icon-48.png" : "dist/icons/icon-48.png",
    128: built ? "icons/icon-128.png" : "dist/icons/icon-128.png",
  },
  content_security_policy: {
    extension_pages:
      `script-src 'self'; object-src 'self'; connect-src 'self' ${supabaseOrigin} ${supabaseWebsocketOrigin};`,
  },
});

const writeJson = (relativePath, value) => {
  const outputPath = resolve(rootDir, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
};

writeJson("manifest.json", createManifest({ built: false }));
writeJson("manifest.dist.json", createManifest({ built: true }));
