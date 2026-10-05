import { createRouter, createWebHistory } from "vue-router";
import { currentUser, refreshSession } from "@/session";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: { name: "posts" } },
    { path: "/login", name: "login", component: () => import("@/views/LoginView.vue") },
    { path: "/posts", name: "posts", component: () => import("@/views/PostsView.vue") },
    { path: "/posts/new", name: "post-new", component: () => import("@/views/PostEditView.vue") },
    {
      path: "/posts/:id/edit",
      name: "post-edit",
      component: () => import("@/views/PostEditView.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: { name: "posts" } },
  ],
});

router.beforeEach(async (to) => {
  // Trust the cached user; only hit the API when we don't have one yet.
  const user = currentUser().value ?? (await refreshSession());
  const authed = user !== null;

  if (to.name !== "login" && !authed) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && authed) {
    return { name: "posts" };
  }
});

export default router;
