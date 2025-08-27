declare module 'firebase/functions';
declare module 'firebase/storage';

// Vite import meta env typing safe-guard
interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly VITE_ENABLE_APPCHECK?: string;
  readonly VITE_RECAPTCHA_V3_SITE_KEY?: string;
}
interface ImportMeta {
  readonly env?: ImportMetaEnv;
}



