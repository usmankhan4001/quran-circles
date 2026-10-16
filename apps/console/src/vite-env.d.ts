/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public. The API origin; empty means same origin behind the dev proxy. */
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
