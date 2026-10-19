import { createRouter, createWebHistory } from "vue-router";
import PostsView from "@/views/PostsView.vue";
import PostEditView from "@/views/PostEditView.vue";
import TagsView from "@/views/TagsView.vue";
import CategoriesView from "@/views/CategoriesView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/posts" },
    { path: "/posts", name: "posts", component: PostsView },
    { path: "/posts/new", name: "post-new", component: PostEditView },
    { path: "/posts/:id/edit", name: "post-edit", component: PostEditView },
    { path: "/tags", name: "tags", component: TagsView },
    { path: "/categories", name: "categories", component: CategoriesView },
  ],
});

export default router;
