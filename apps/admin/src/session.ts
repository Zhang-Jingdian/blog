import { ref } from "vue";
import { authClient } from "./auth";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

const user = ref<SessionUser | null>(null);

/** Reactive current user (null when signed out). */
export function currentUser() {
  return user;
}

/** Read the cookie session from the API and cache the user. */
export async function refreshSession(): Promise<SessionUser | null> {
  try {
    const { data } = await authClient.getSession();
    user.value = data?.user
      ? { id: data.user.id, email: data.user.email, name: data.user.name }
      : null;
  } catch {
    user.value = null;
  }
  return user.value;
}

export function clearSession() {
  user.value = null;
}
