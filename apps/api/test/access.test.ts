import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  clearAccessKeyCache,
  encodeJwtSegment,
  verifyAccessJwt,
  type JsonWebKeySet,
} from "../src/lib/access.ts";
import { assertAdminAccess } from "../middleware/02.access.ts";

const TEAM_DOMAIN = "example.cloudflareaccess.com";
const AUDIENCE = "aud-tag-123";
const KID = "key-1";

async function createSigner(): Promise<{
  privateKey: CryptoKey;
  jwks: JsonWebKeySet;
}> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { privateKey: pair.privateKey, jwks: { keys: [{ ...publicJwk, kid: KID }] } };
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signToken(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "RS256", kid: KID, typ: "JWT" },
): Promise<string> {
  const head = encodeJwtSegment(header);
  const body = encodeJwtSegment(payload);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${base64url(new Uint8Array(signature))}`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return { aud: [AUDIENCE], email: "me@example.com", iat: now, exp: now + 600, ...overrides };
}

function verifier(fetchJwks: () => Promise<JsonWebKeySet>) {
  return (token: string) =>
    verifyAccessJwt(token, { teamDomain: TEAM_DOMAIN, audience: AUDIENCE, fetchJwks });
}

afterEach(() => {
  clearAccessKeyCache();
});

describe("verifyAccessJwt", () => {
  it("accepts a correctly signed token", async () => {
    const { privateKey, jwks } = await createSigner();
    const token = await signToken(privateKey, claims());

    const result = await verifier(async () => jwks)(token);

    expect(result.email).toBe("me@example.com");
  });

  it("requests the certs endpoint of the configured team domain", async () => {
    const { privateKey, jwks } = await createSigner();
    const token = await signToken(privateKey, claims());
    const urls: string[] = [];

    await verifyAccessJwt(token, {
      teamDomain: TEAM_DOMAIN,
      audience: AUDIENCE,
      fetchJwks: async (url) => {
        urls.push(url);
        return jwks;
      },
    });

    expect(urls).toEqual([`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`]);
  });

  it("rejects an expired token", async () => {
    const { privateKey, jwks } = await createSigner();
    const now = Math.floor(Date.now() / 1000);
    const token = await signToken(privateKey, claims({ iat: now - 1000, exp: now - 10 }));

    await expect(verifier(async () => jwks)(token)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a token for another application", async () => {
    const { privateKey, jwks } = await createSigner();
    const token = await signToken(privateKey, claims({ aud: ["someone-else"] }));

    await expect(verifier(async () => jwks)(token)).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("different application"),
    });
  });

  it("rejects a token whose payload was changed after signing", async () => {
    const { privateKey, jwks } = await createSigner();
    const token = await signToken(privateKey, claims());
    const [head, , signature] = token.split(".");
    const forged = `${head}.${encodeJwtSegment(claims({ email: "attacker@example.com" }))}.${signature}`;

    await expect(verifier(async () => jwks)(forged)).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("signature"),
    });
  });

  it("rejects a token signed by a key that is not published", async () => {
    const { privateKey } = await createSigner();
    const { jwks: otherJwks } = await createSigner();
    const token = await signToken(privateKey, claims());

    await expect(verifier(async () => otherJwks)(token)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an unsigned (alg=none) token", async () => {
    const { jwks } = await createSigner();
    const token = `${encodeJwtSegment({ alg: "none" })}.${encodeJwtSegment(claims())}.`;

    await expect(verifier(async () => jwks)(token)).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("algorithm"),
    });
  });

  it("rejects a malformed token", async () => {
    const { jwks } = await createSigner();

    await expect(verifier(async () => jwks)("not-a-jwt")).rejects.toMatchObject({ status: 401 });
  });
});

describe("assertAdminAccess", () => {
  function request(path: string, headers: Record<string, string> = {}) {
    return {
      path,
      header: (name: string) => headers[name.toLowerCase()],
    };
  }

  it("ignores public paths", async () => {
    await expect(
      assertAdminAccess(request("/api/posts"), { isProduction: true }),
    ).resolves.toBeUndefined();
  });

  it("rejects an admin request without an assertion header", async () => {
    await expect(
      assertAdminAccess(request("/api/admin/posts"), {
        teamDomain: TEAM_DOMAIN,
        audience: AUDIENCE,
        isProduction: true,
      }),
    ).rejects.toMatchObject({ status: 401, message: expect.stringContaining("Missing") });
  });

  it("accepts an admin request with a valid assertion", async () => {
    const { privateKey, jwks } = await createSigner();
    const token = await signToken(privateKey, claims());

    await expect(
      assertAdminAccess(request("/api/admin/posts", { "cf-access-jwt-assertion": token }), {
        teamDomain: TEAM_DOMAIN,
        audience: AUDIENCE,
        isProduction: true,
        fetchJwks: async () => jwks,
      }),
    ).resolves.toBeUndefined();
  });

  it("fails closed in production when the guard is not configured", async () => {
    await expect(
      assertAdminAccess(request("/api/admin/posts"), { isProduction: true }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("allows everything in development when the guard is not configured, and says so once", async () => {
    const warnings: string[] = [];

    await assertAdminAccess(request("/api/admin/posts"), {
      isProduction: false,
      warn: (message) => warnings.push(message),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("unauthenticated");
  });
});
