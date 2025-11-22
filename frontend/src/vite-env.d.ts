/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_IPFS_GATEWAY: string
  readonly VITE_ATTESTATION_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
