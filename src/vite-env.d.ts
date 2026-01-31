/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NCE_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __BUILD_SHA__: string
