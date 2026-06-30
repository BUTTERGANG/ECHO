/**
 * Vault: passphrase-based key management for at-rest encryption (handoff §4.3).
 *
 * The derived AES key is held in module memory only (`cryptoKey`). Persisted
 * to storage: ONLY the salt + a verifier blob (safe to store in the clear).
 * The passphrase is never stored — lose it and the data is unrecoverable.
 *
 * Web-only for now (uses WebCrypto via `@/utils/encryption`). The Settings UI
 * gates this behind `Platform.OS === 'web'`.
 */
import { Platform } from 'react-native';

import * as enc from '@/utils/encryption';
import { useVaultStore } from '@/stores/vaultStore';

interface VaultMeta {
  enabled: boolean;
  salt: string;
  verifier: string;
}

const META_KEY = 'echo.vault.meta';

// Held in memory only — never persisted, never in a store.
let cryptoKey: CryptoKey | null = null;

function storage(): Storage | null {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function readMeta(): VaultMeta | null {
  const raw = storage()?.getItem(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultMeta;
  } catch {
    return null;
  }
}

function writeMeta(meta: VaultMeta): void {
  storage()?.setItem(META_KEY, JSON.stringify(meta));
}

function clearMeta(): void {
  storage()?.removeItem(META_KEY);
}

/** Read persisted state on app start and set the initial status. */
export function hydrateVault(): void {
  const meta = readMeta();
  useVaultStore.getState().setStatus(meta?.enabled ? 'locked' : 'disabled');
  useVaultStore.getState().setHydrated(true);
}

export function isEncryptionEnabled(): boolean {
  return readMeta()?.enabled === true;
}

export function isUnlocked(): boolean {
  return cryptoKey !== null;
}

/** Turn on encryption with a new passphrase. Leaves the vault unlocked. */
export async function enableEncryption(passphrase: string): Promise<void> {
  const salt = enc.randomSaltB64();
  const key = await enc.deriveKey(passphrase, salt);
  const verifier = await enc.makeVerifier(key);
  writeMeta({ enabled: true, salt, verifier });
  cryptoKey = key;
  useVaultStore.getState().setStatus('unlocked');
}

/** Unlock with the passphrase. Returns false on wrong passphrase. */
export async function unlock(passphrase: string): Promise<boolean> {
  const meta = readMeta();
  if (!meta?.enabled) return false;
  const key = await enc.deriveKey(passphrase, meta.salt);
  if (!(await enc.checkVerifier(meta.verifier, key))) return false;
  cryptoKey = key;
  useVaultStore.getState().setStatus('unlocked');
  return true;
}

/** Drop the in-memory key (e.g. on background). Re-unlock required to read. */
export function lock(): void {
  cryptoKey = null;
  if (isEncryptionEnabled()) useVaultStore.getState().setStatus('locked');
}

/** Turn off encryption. Caller MUST decrypt stored data first (still unlocked). */
export async function disableEncryption(): Promise<void> {
  clearMeta();
  cryptoKey = null;
  useVaultStore.getState().setStatus('disabled');
}

/** Encrypt a value for storage if the vault is unlocked; otherwise pass through. */
export async function encryptField(text: string | null | undefined): Promise<string | null> {
  if (text == null) return null;
  if (!cryptoKey) return text;
  return enc.encryptString(text, cryptoKey);
}

/** Decrypt a stored value. Throws if it's encrypted but the vault is locked. */
export async function decryptField(value: string | null | undefined): Promise<string | null> {
  if (value == null) return null;
  if (!enc.isEncrypted(value)) return value;
  if (!cryptoKey) throw new Error('Vault is locked.');
  return enc.decryptString(value, cryptoKey);
}

export function getKey(): CryptoKey | null {
  return cryptoKey;
}
