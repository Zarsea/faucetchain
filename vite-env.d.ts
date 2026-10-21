/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injetado pelo vite.config: o commit curto que gerou este bundle. */
declare const __BUILD_COMMIT__: string;
