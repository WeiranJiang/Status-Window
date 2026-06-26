export function isChromeExtension(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id) && Boolean(chrome.identity?.getRedirectURL);
}

function getLocalAuthOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    return window.location.origin;
  }

  return "http://127.0.0.1:5173";
}

export function getAuthRedirectUrl(): string {
  if (isChromeExtension()) {
    return chrome.identity.getRedirectURL();
  }

  if (import.meta.env.DEV) {
    return getLocalAuthOrigin();
  }

  return window.location.origin;
}

export function getEmailAuthRedirectUrl(): string | undefined {
  if (isChromeExtension()) {
    // Email confirmation links open in the user's normal browser, not in
    // chrome.identity.launchWebAuthFlow, so a chromiumapp.org URL is not a
    // useful target here. Let Supabase fall back to the configured Site URL.
    return undefined;
  }

  if (import.meta.env.DEV) {
    return getLocalAuthOrigin();
  }

  return window.location.origin;
}

export function logExtensionRedirectUrl(): void {
  if (!isChromeExtension() || !import.meta.env.DEV) {
    return;
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  const origin = new URL(redirectUrl).origin;

  console.log("======================================");
  console.log("STATUS WINDOW EXTENSION REDIRECT URL");
  console.log("Add this URL to Supabase Authentication -> URL Configuration -> Redirect URLs:");
  console.log(redirectUrl);
  console.log("Also add wildcard version:");
  console.log(`${redirectUrl}**`);
  console.log("Chrome extension origin:");
  console.log(origin);
  console.log("======================================");
}
