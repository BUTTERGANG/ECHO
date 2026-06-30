/**
 * Encryption primitives — WEB / default (handoff §3.3, §4.3).
 *
 * AES-256-GCM with a key derived from a user passphrase via PBKDF2-SHA-256.
 * Uses the standard WebCrypto API (`crypto.subtle`), available in browsers and
 * in Node (so the round-trip is unit-testable). React Native has no
 * `crypto.subtle`, so `encryption.native.ts` stubs this until a native crypto
 * backend is chosen.
 *
 * Honest threat model (web): real at-rest protection here depends on the
 * passphrase NOT being stored. We persist only the salt + a verifier blob;
 * the derived key lives in memory only. Lose the passphrase → data is
 * unrecoverable by design.
 */

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERIFIER_PLAINTEXT = 'echo-vault-verifier-v1';

/** Marker prefix so encrypted column values are self-describing. */
export const ENC_PREFIX = 'enc:v1:';

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa exists in browsers and Node 16+ globals.
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function randomSaltB64(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return toBase64(salt);
}

/** Derive a non-extractable AES-256-GCM key from a passphrase + salt. */
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltB64) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt UTF-8 text → `enc:v1:<base64(iv|ciphertext)>`. */
export async function encryptString(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      new TextEncoder().encode(plaintext) as BufferSource,
    ),
  );
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return ENC_PREFIX + toBase64(packed);
}

/** Decrypt a value produced by encryptString. Throws on wrong key (GCM auth). */
export async function decryptString(value: string, key: CryptoKey): Promise<string> {
  if (!isEncrypted(value)) return value;
  const packed = fromBase64(value.slice(ENC_PREFIX.length));
  const iv = packed.slice(0, IV_BYTES);
  const ct = packed.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/** Create a verifier blob to later confirm a passphrase without storing the key. */
export async function makeVerifier(key: CryptoKey): Promise<string> {
  return encryptString(VERIFIER_PLAINTEXT, key);
}

/** Returns true if `key` correctly decrypts the verifier. */
export async function checkVerifier(verifier: string, key: CryptoKey): Promise<boolean> {
  try {
    return (await decryptString(verifier, key)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
