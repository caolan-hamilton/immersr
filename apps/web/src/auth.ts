// Sign in with Google through Cognito's managed login (ADR 0003): authorization code flow with PKCE.
// Tokens live in localStorage so the Learner stays signed in between visits; the refresh token renews them.
import { WebConfig } from "@immersr/shared";

const STORAGE_KEY = "immersr.tokens";
const VERIFIER_KEY = "immersr.pkce-verifier";

interface Tokens {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

let configPromise: Promise<WebConfig> | undefined;
export const loadConfig = () =>
  (configPromise ??= fetch("/config.json").then(async (r) => {
    if (!r.ok) throw new Error(`Couldn't load config (${r.status})`);
    return WebConfig.parse(await r.json());
  }));

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const readTokens = (): Tokens | undefined => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Tokens) : undefined;
};

interface TokenResponse {
  id_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestTokens(params: Record<string, string>, previousRefreshToken?: string): Promise<Tokens> {
  const config = await loadConfig();
  const response = await fetch(`${config.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, ...params }),
  });
  if (!response.ok) throw new Error(`Sign-in failed (${response.status})`);
  const body = (await response.json()) as TokenResponse;
  const tokens: Tokens = {
    idToken: body.id_token,
    refreshToken: body.refresh_token ?? previousRefreshToken ?? "",
    // Renew a minute early so a request never goes out with a token about to expire.
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  return tokens;
}

/** Sends the browser to Cognito's managed login, skipping straight to Google. */
export async function signIn(): Promise<void> {
  const config = await loadConfig();
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const query = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: window.location.origin,
    identity_provider: "Google",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${config.cognitoDomain}/oauth2/authorize?${query}`);
}

/** If Cognito just redirected back with a code, trades it for tokens and cleans the URL. */
export async function completeSignInIfRedirected(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return;
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  window.history.replaceState({}, "", window.location.origin + url.pathname);
  if (!verifier) throw new Error("Sign-in was interrupted; please try again.");
  await requestTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: window.location.origin,
    code_verifier: verifier,
  });
}

export const isSignedIn = () => readTokens() !== undefined;

/** A valid ID token for the API, refreshing it if needed. Undefined when the Learner must sign in again. */
export async function getIdToken(): Promise<string | undefined> {
  const tokens = readTokens();
  if (!tokens) return undefined;
  if (tokens.expiresAt > Date.now()) return tokens.idToken;
  try {
    return (await requestTokens({ grant_type: "refresh_token", refresh_token: tokens.refreshToken }, tokens.refreshToken))
      .idToken;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

/** The signed-in Learner's email, read from the ID token's claims (display only; the API verifies the token itself). */
export function getEmail(): string | undefined {
  const idToken = readTokens()?.idToken;
  if (!idToken) return undefined;
  try {
    const payload = idToken.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)))) as {
      email?: unknown;
    };
    return typeof claims.email === "string" ? claims.email : undefined;
  } catch {
    return undefined;
  }
}

export async function signOut(): Promise<void> {
  const config = await loadConfig();
  localStorage.removeItem(STORAGE_KEY);
  const query = new URLSearchParams({ client_id: config.clientId, logout_uri: window.location.origin });
  window.location.assign(`${config.cognitoDomain}/logout?${query}`);
}
