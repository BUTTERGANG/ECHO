/**
 * At-rest encryption status (handoff §4.3).
 *  - disabled: no passphrase set; data stored in plaintext.
 *  - locked:   encryption enabled but key not in memory (needs unlock).
 *  - unlocked: key in memory; reads/writes are transparently de/encrypted.
 *
 * The derived key itself lives ONLY in `services/vault.ts` module memory — it
 * is intentionally never placed in this (or any) store.
 */
import { create } from 'zustand';

export type VaultStatus = 'disabled' | 'locked' | 'unlocked';

interface VaultState {
  status: VaultStatus;
  hydrated: boolean;
  setStatus: (status: VaultStatus) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  status: 'disabled',
  hydrated: false,
  setStatus: (status) => set({ status }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
