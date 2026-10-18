import { BANK_MAX_BYTES, isBankSnapshot, type BankSnapshot } from "./bank";

export const BANK_STORAGE_KEY = "merchvision-bank-v1";

export function loadBank(): { snapshot: BankSnapshot | null; warning: string | null } {
  try {
    const raw = window.localStorage.getItem(BANK_STORAGE_KEY);
    if (raw === null) return { snapshot: null, warning: null };
    if (raw.length > BANK_MAX_BYTES) throw new Error("Oversized snapshot");
    const snapshot: unknown = JSON.parse(raw);
    if (!isBankSnapshot(snapshot)) throw new Error("Invalid snapshot");
    return { snapshot, warning: null };
  } catch {
    return { snapshot: null, warning: "The saved bank could not be loaded. Import your bank again." };
  }
}

export function saveBank(snapshot: BankSnapshot): boolean {
  try { window.localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(snapshot)); return true; }
  catch { return false; }
}

export function clearBank(): boolean {
  try { window.localStorage.removeItem(BANK_STORAGE_KEY); return true; }
  catch { return false; }
}
