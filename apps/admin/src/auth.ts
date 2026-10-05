import { createAuthClient } from "better-auth/vue";

// Admin is a plain Vite SPA, so it uses Better Auth's Vue client directly
// (not void/client, which is meant for Void apps).
//
// In dev VITE_API_BASE_URL is empty: requests stay relative and go through the
// Vite /api proxy, so cookies are same-origin and no CORS is involved. Point
// baseURL at the API origin for a deployed, non-proxied admin.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || undefined,
});
