import { defineAuth } from "void/auth";

// Better Auth configuration.
// void fills in baseURL / basePath("/api/auth") / database / secret / trustedOrigins
// automatically and mounts the /api/auth/** routes.
// emailAndPassword.disableSignUp = true: public registration is disabled; sign-in only.
// The first admin account must be created via a seed script or one-off step
// (there is no public sign-up entry).
export default defineAuth(({ defaults }) => ({
  ...defaults,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  // The admin runs locally and reaches a deployed API through Vite's dev proxy,
  // which preserves the target Host — so the browser's Origin (localhost:5173)
  // differs from the API's own origin. Add it to Void's default origins.
  trustedOrigins: async (request) => {
    const configured = defaults.trustedOrigins;
    const origins =
      typeof configured === "function" ? await configured(request) : (configured ?? []);
    return [...origins, "http://localhost:5173"];
  },
}));
