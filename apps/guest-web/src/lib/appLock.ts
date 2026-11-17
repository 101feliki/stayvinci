// App lock with the phone's own security: Face ID, fingerprint, or the phone's PIN/pattern.
// Uses WebAuthn with the built-in ("platform") authenticator and user verification required.
// Stayvinci never sees a fingerprint or face: the phone checks it and only says "verified".
//
// What it protects: someone picking up an unlocked phone and opening the app. The lock key
// lives on this device only; nothing is sent to the server. If the key is lost (passkeys
// cleared, new phone), the guest can sign out instead: their data is on the server, so signing
// out reveals nothing and they simply sign in again.

const KEY = 'sv.guest.lock';
/** Coming back after this long asks to unlock again. */
export const RELOCK_AFTER_MS = 60_000;

interface Saved {
  id: string; // credential id, base64url
  at: string;
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function saved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export const appLock = {
  /** True when the lock is switched on for this device. */
  enabled(): boolean {
    return saved() !== null;
  },

  /** Whether this phone/browser can verify the person (Face ID, fingerprint or device PIN). */
  async supported(): Promise<boolean> {
    try {
      return (
        typeof window.PublicKeyCredential !== 'undefined' &&
        (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
      );
    } catch {
      return false;
    }
  },

  /** Switch the lock on: the phone asks for Face ID/fingerprint/PIN once to create the key. */
  async enable(): Promise<void> {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: 'Stayvinci' },
        user: { id: random(16), name: 'Stayvinci app lock', displayName: 'Stayvinci app lock' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        attestation: 'none',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) throw new Error('The lock was not set up.');
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ id: b64url(cred.rawId), at: new Date().toISOString() }),
      );
    } catch {
      throw new Error('This browser cannot keep the lock (private window?).');
    }
  },

  /** Ask the phone to verify the person. Resolves true only when it confirmed them. */
  async unlock(): Promise<boolean> {
    const s = saved();
    if (!s) return true;
    const a = (await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: fromB64url(s.id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!a) return false;
    // authenticatorData byte 32 holds the flags; 0x04 = the person was verified (UV).
    const data = new Uint8Array((a.response as AuthenticatorAssertionResponse).authenticatorData);
    return ((data[32] ?? 0) & 0x04) !== 0;
  },

  /** Switch the lock off (callers verify the person first). */
  disable(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
