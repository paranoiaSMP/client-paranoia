/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARANOIA_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}