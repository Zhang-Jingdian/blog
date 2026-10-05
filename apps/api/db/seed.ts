// db/seed.ts
//
// Bootstraps the first admin account for Better Auth (email + password).
// Public sign-up is disabled in auth.ts, so the operator account has to be
// created here instead of through the registration endpoint.
//
// Usage (the password is never hardcoded — provide it via environment variables):
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' void db seed
//
// Idempotency: if a user with the given email already exists, the script leaves
// it (and its password) untouched, so it never overwrites an existing admin.
//
// Note: `void db seed` itself resets the LOCAL database (drops all data and
// re-applies migrations) before running this script, so it is a local-dev
// bootstrap. The guard below still protects against overwriting an existing
// admin's password whenever the script runs against a database that already
// contains the account.
//
// The generated `../.void/better-auth-schema.ts` (auth table definitions) is
// created by `void prepare` / `vp dev` / `void db generate`; run one of those
// before the first seed on a fresh checkout.

import { defineSeed } from "void/seed";
import { eq } from "void/db";
import { hashPassword } from "@better-auth/utils/password";
import { accountTable, userTable } from "../.void/better-auth-schema.ts";

// `process` is available in the Node context that runs seeds, but the app's
// tsconfig only loads Vite/void ambient types, so declare the minimal shape here.
declare const process: { env: Record<string, string | undefined> };

export default defineSeed<typeof import("./schema")>(async ({ db }) => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("[seed] ADMIN_EMAIL and ADMIN_PASSWORD are not set; skipping admin bootstrap.");
    return;
  }

  const existing = db.select().from(userTable).where(eq(userTable.email, email)).get();
  if (existing) {
    console.log(`[seed] Admin "${email}" already exists; leaving it unchanged.`);
    return;
  }

  // account.accountId must equal user.id for the "credential" provider.
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db.insert(userTable).values({
    id: userId,
    name: "Admin",
    email,
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(accountTable).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[seed] Created admin account for "${email}".`);
});
