/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin. Empty in dev — requests go through the Vite `/api` proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}
