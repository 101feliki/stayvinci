import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { argon2id, argon2Verify } from 'hash-wasm';

/** URL-safe random token (refresh tokens, email links). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest();

export const hmac = (key: Buffer, value: string) =>
  createHmac('sha256', key).update(value).digest();

export const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** Six-digit SMS code with no modulo bias. */
export const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Argon2id (spec §18), via WebAssembly so it runs everywhere without native modules. */
export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MiB
    hashLength: 32,
    outputType: 'encoded',
  });
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) {
    // Spend similar time when there's no account, so timing doesn't reveal which emails exist.
    await hashPassword(password);
    return false;
  }
  return argon2Verify({ password, hash: encoded });
}

/* ---------- AES-256-GCM for small secrets at rest (TOTP seeds) ---------- */

export function encrypt(key: Buffer, plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]); // iv(12) | tag(16) | ciphertext
}

export function decrypt(key: Buffer, packed: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
}

/* ---------- TOTP (RFC 6238): 30-second steps, 6 digits, SHA-1 for app compatibility ---------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function totpAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/** Accepts the current code and one step either side for clock drift. */
export function verifyTotp(secret: Buffer, code: string, now = Date.now()): boolean {
  const step = Math.floor(now / 30_000);
  return [-1, 0, 1].some((d) =>
    safeEqual(Buffer.from(totpAt(secret, step + d)), Buffer.from(code)),
  );
}
