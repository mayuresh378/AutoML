import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth, type GoogleAuthProvider as GoogleAuthProviderType } from 'firebase/auth';
import type { FirebaseError } from 'firebase/app';

/**
 * Firebase Web client configuration.
 *
 * Credentials are read exclusively through Vite build-time environment
 * variables (`import.meta.env.VITE_FIREBASE_*`). Never hardcode them here.
 *
 * Firebase Web setup is safe for browsers: it exposes only the public web
 * API key. It must NEVER include Firebase Admin SDK credentials, service
 * account private keys, database secrets, or server SDK credentials.
 *
 * If the configuration is missing or invalid we do NOT crash the application.
 * `auth` and `googleProvider` are exposed as possibly-null so the surrounding
 * app can render a friendly configuration state and degrade gracefully.
 */

const raw = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const REQUIRED: Array<keyof typeof raw> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const LABELS: Record<keyof typeof raw, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

const PLACEHOLDER = /change-me|your[-_]|placeholder|xxxx/i;

const missingOrInvalid = REQUIRED.filter((key) => {
  const v = raw[key];
  return !v?.trim() || PLACEHOLDER.test(v);
}).map((key) => LABELS[key]);

export const isFirebaseConfigured = missingOrInvalid.length === 0;

export const firebaseInitError: string | null = isFirebaseConfigured
  ? null
  : `Firebase Web configuration is incomplete or invalid (${missingOrInvalid.join(', ') || 'none'}). Set the VITE_FIREBASE_* environment variables at build time in Vercel.`;

// Development-only diagnostic.
if (import.meta.env.DEV) {
  if (!isFirebaseConfigured) {
    // eslint-disable-next-line no-console
    console.warn(
      '[firebase] Not configured. Missing/invalid build-time env vars:',
      missingOrInvalid.length ? missingOrInvalid.join(', ') : 'unknown',
    );
  } else {
    // eslint-disable-next-line no-console
    console.info('[firebase] Configured for project:', raw.projectId);
  }
}

// Expose a stable marker on <html> so layout/providers can react to config
// state without throwing during import.
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-firebase-configured', String(isFirebaseConfigured));
}

interface FirebaseHandle {
  app: ReturnType<typeof getApp> | null;
  auth: Auth | null;
}

let _handle: FirebaseHandle | null | undefined;

/**
 * Safely initialize Firebase once. Never throws — on any failure it returns a
 * null handle so the application can render a config/error state instead of
 * crashing React (blank/black screen).
 */
function initFirebase(): FirebaseHandle {
  if (_handle !== undefined) return _handle!;
  if (!isFirebaseConfigured) {
    _handle = { app: null, auth: null };
    return _handle;
  }

  try {
    const firebaseConfig = {
      apiKey: raw.apiKey,
      authDomain: raw.authDomain,
      projectId: raw.projectId,
      storageBucket: raw.storageBucket,
      messagingSenderId: raw.messagingSenderId,
      appId: raw.appId,
    };
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const authInstance = getAuth(app);
    _handle = { app, auth: authInstance };
  } catch (e) {
    const code = (e as FirebaseError)?.code || (e as Error)?.message || 'unknown';
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[firebase] Initialization failed (will stay disabled):', code);
    }
    _handle = { app: null, auth: null };
  }
  return _handle;
}// Lazily created Google Auth provider — created on first use, never throws.
let _googleProvider: GoogleAuthProviderType | null | undefined;
function getGoogleProvider(): GoogleAuthProviderType | null {
  if (!isFirebaseConfigured) return null;
  if (_googleProvider !== undefined) return _googleProvider;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    _googleProvider = provider;
  } catch {
    _googleProvider = null;
  }
  return _googleProvider;
}

// Initialize once at import time (cheap now that it cannot throw).
const handle = initFirebase();

// Stable named exports used by LoginPage and useAuth. They are nullable and
// consumers must null-guard before use.
export const auth: Auth | null = handle.auth;
export const googleProvider: GoogleAuthProviderType | null = getGoogleProvider();
export const firebaseApp = handle.app;
