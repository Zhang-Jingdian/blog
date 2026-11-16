import { AppError } from "./error.ts";

// Cloudflare Access signs a JWT for every request that passed its policy and
// forwards it as `Cf-Access-Jwt-Assertion`. Verifying that token inside the
// Worker is what makes the admin API safe on its own: the Access policy lives at
// the edge, so a path or hostname it does not cover (or a direct Worker URL)
// would otherwise reach these handlers unauthenticated. CORS is not
// authentication — it only constrains browsers, not curl.

export interface JsonWebKeySet {
  keys: (JsonWebKey & { kid?: string })[];
}

export type JwksFetcher = (url: string) => Promise<JsonWebKeySet>;

export interface AccessTokenOptions {
  // Zero Trust team domain, e.g. "myteam.cloudflareaccess.com".
  teamDomain: string;
  // AUD tag of the Access application that fronts the API.
  audience: string;
  // Injectable clock (ms since epoch) so expiry can be tested without waiting.
  now?: number;
  fetchJwks?: JwksFetcher;
}

export interface AccessClaims {
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat?: number;
  email?: string;
  sub?: string;
  [claim: string]: unknown;
}

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  expiresAt: number;
}

// Keys rotate rarely; caching them per isolate keeps the certs endpoint off the
// hot path. An unknown `kid` forces a refresh, which covers rotation.
const KEY_TTL_MS = 60 * 60 * 1000;
const keyCache = new Map<string, CachedKeys>();

export function clearAccessKeyCache(): void {
  keyCache.clear();
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeJson<T>(segment: string, what: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
  } catch {
    throw new AppError(401, `Malformed Access token ${what}`);
  }
}

async function importRsaKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

const defaultFetchJwks: JwksFetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new AppError(503, "Unable to reach the Cloudflare Access certs endpoint");
  }
  return (await res.json()) as JsonWebKeySet;
};

async function loadKeys(
  certsUrl: string,
  fetchJwks: JwksFetcher,
  forceRefresh: boolean,
): Promise<Map<string, CryptoKey>> {
  const cached = keyCache.get(certsUrl);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.keys;

  const set = await fetchJwks(certsUrl);
  const keys = new Map<string, CryptoKey>();
  for (const jwk of set.keys) {
    if (jwk.kid) keys.set(jwk.kid, await importRsaKey(jwk));
  }
  keyCache.set(certsUrl, { keys, expiresAt: Date.now() + KEY_TTL_MS });
  return keys;
}

async function resolveKey(
  kid: string | undefined,
  certsUrl: string,
  fetchJwks: JwksFetcher,
): Promise<CryptoKey> {
  if (!kid) throw new AppError(401, "Access token has no key id");

  const cached = await loadKeys(certsUrl, fetchJwks, false);
  const hit = cached.get(kid);
  if (hit) return hit;

  // A key we have never seen may mean Cloudflare rotated the signing keys.
  const refreshed = await loadKeys(certsUrl, fetchJwks, true);
  const rotated = refreshed.get(kid);
  if (rotated) return rotated;
  throw new AppError(401, "Access token was signed with an unknown key");
}

// Verify the token's signature, lifetime and audience. Throws AppError(401) for
// anything that fails, so the caller never has to interpret the result.
export async function verifyAccessJwt(
  token: string,
  options: AccessTokenOptions,
): Promise<AccessClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AppError(401, "Malformed Access token");
  const [rawHeader, rawPayload, rawSignature] = parts as [string, string, string];

  const header = decodeJson<{ alg?: string; kid?: string }>(rawHeader, "header");
  if (header.alg !== "RS256") {
    throw new AppError(401, "Unsupported Access token algorithm");
  }

  const certsUrl = `https://${options.teamDomain}/cdn-cgi/access/certs`;
  const key = await resolveKey(header.kid, certsUrl, options.fetchJwks ?? defaultFetchJwks);
  const signature = base64UrlToBytes(rawSignature);
  const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);

  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed);
  if (!valid) throw new AppError(401, "Invalid Access token signature");

  const claims = decodeJson<AccessClaims>(rawPayload, "payload");
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);

  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
    throw new AppError(401, "Access token has expired");
  }
  // 60s of clock skew, the same tolerance Cloudflare documents for nbf.
  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + 60) {
    throw new AppError(401, "Access token is not valid yet");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.audience)) {
    throw new AppError(401, "Access token was issued for a different application");
  }

  return claims;
}

// Exported for tests: builds a token with the same encoding the verifier expects.
export function encodeJwtSegment(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}
