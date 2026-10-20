/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELEASE_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
