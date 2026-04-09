/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB_SIGN_IN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
