import { defineAuth } from "void/auth";

// Better Auth configuration.
// void fills in baseURL / basePath("/api/auth") / database / secret / trustedOrigins
// automatically and mounts the /api/auth/** routes.
// emailAndPassword.disableSignUp = true: public registration is disabled; sign-in only.
// The first admin account must be created via a seed script or one-off step
// (there is no public sign-up entry).
export default defineAuth({
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
});
