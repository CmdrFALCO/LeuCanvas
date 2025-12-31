/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    VITE_DEV_SERVER_URL?: string;
  }
}
