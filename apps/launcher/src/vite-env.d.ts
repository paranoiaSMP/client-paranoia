/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PARANOIA_API_BASE_URL?: string;
  readonly PARANOIA_CDN_BASE_URL?: string;
  readonly PARANOIA_UPDATE_CHANNEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
