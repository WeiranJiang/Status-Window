import { supabase, supabaseAuthCallbackUrl } from "./supabaseClient";
import { getAuthRedirectUrl, isChromeExtension } from "./authRedirect";

export async function signInWithGoogle() {
  const redirectTo = getAuthRedirectUrl();
  const shouldLogAuthDebug = import.meta.env.DEV;

  if (isChromeExtension()) {
    if (shouldLogAuthDebug) {
      console.log("Starting Status Window Google sign-in with redirect:", redirectTo);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error("No Google OAuth URL returned by Supabase.");
    }

    if (shouldLogAuthDebug) {
      console.log("Supabase returned Google OAuth URL:", data.url);
    }

    const resultUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true }, (returnedUrl) => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          if (lastError.message?.includes("Authorization page could not be loaded")) {
            reject(
              new Error(
                `Google sign-in could not open its authorization page. In Supabase, add ${redirectTo} and ${redirectTo}** to Authentication -> URL Configuration -> Redirect URLs. In Google Cloud, keep the authorized redirect URI set to ${supabaseAuthCallbackUrl}.`,
              ),
            );
            return;
          }

          reject(new Error(lastError.message));
          return;
        }

        if (!returnedUrl) {
          reject(new Error("Google authorization was cancelled or failed."));
          return;
        }

        resolve(returnedUrl);
      });
    });

    const url = new URL(resultUrl);
    const code = url.searchParams.get("code");

    if (code) {
      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw exchangeError;
      }
      return sessionData;
    }

    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        throw sessionError;
      }

      return sessionData;
    }

    throw new Error("Could not complete Google login from returned auth URL.");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
