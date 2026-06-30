/**
 * Encryption primitives — NATIVE stub.
 *
 * React Native (Hermes) has no `crypto.subtle`. A native build should back
 * this with SQLCipher (whole-DB encryption) or a native AES module instead of
 * app-level field encryption. Stubbed so the shared surface typechecks; the
 * web build provides the real implementation in `encryption.ts`.
 */
export const ENC_PREFIX = 'enc:v1:';

const NOT_IMPLEMENTED =
  'At-rest encryption is web-only for now. Native should use SQLCipher — see WEB_FIRST_NOTES.md.';

export function randomSaltB64(): string {
  throw new Error(NOT_IMPLEMENTED);
}

export async function deriveKey(_passphrase: string, _saltB64: string): Promise<CryptoKey> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function encryptString(_plaintext: string, _key: CryptoKey): Promise<string> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function decryptString(value: string, _key: CryptoKey): Promise<string> {
  return value;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

export async function makeVerifier(_key: CryptoKey): Promise<string> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function checkVerifier(_verifier: string, _key: CryptoKey): Promise<boolean> {
  return false;
}
