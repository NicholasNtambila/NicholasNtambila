/**
 * Offline Queue (Web fallback) — persists pending cashier sales in localStorage
 * when Supabase is unreachable and automatically syncs them when connectivity is restored.
 */

export interface SalePayload {
  idempotencyKey: string;
  items: { product_id: string; quantity: number }[];
  payments: { method: string; amount: number }[];
}

export interface PendingSale {
  id: string;
  tenantId: string;
  branchId: string;
  payload: SalePayload;
  createdAt: number;
  syncedAt: number | null;
  retryCount: number;
}

const STORAGE_KEY = 'sunga_offline_pending_sales';

function getStoredSales(): PendingSale[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingSale[]) : [];
  } catch {
    return [];
  }
}

function saveStoredSales(sales: PendingSale[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
  } catch {
    // Ignore storage quota or disabled storage
  }
}

/** Persist a sale record locally for later sync. */
export function enqueueSale(
  id: string,
  tenantId: string,
  branchId: string,
  payload: SalePayload,
): void {
  const current = getStoredSales();
  if (current.some((s) => s.id === id)) return;
  current.push({
    id,
    tenantId,
    branchId,
    payload,
    createdAt: Date.now(),
    syncedAt: null,
    retryCount: 0,
  });
  saveStoredSales(current);
}

/** Return all unsynced (pending) sales ordered oldest-first. */
export function listPendingSales(): PendingSale[] {
  const current = getStoredSales();
  return current
    .filter((s) => s.syncedAt === null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Mark a sale as successfully synced. */
export function markSynced(id: string): void {
  const current = getStoredSales();
  const target = current.find((s) => s.id === id);
  if (target) {
    target.syncedAt = Date.now();
    saveStoredSales(current);
  }
}

/** Increment the retry counter for a failed sync attempt. */
export function incrementRetry(id: string): void {
  const current = getStoredSales();
  const target = current.find((s) => s.id === id);
  if (target) {
    target.retryCount = (target.retryCount || 0) + 1;
    saveStoredSales(current);
  }
}

/** Remove synced records older than maxAgeDays. */
export function pruneOldSynced(maxAgeDays = 30): void {
  const current = getStoredSales();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const filtered = current.filter(
    (s) => s.syncedAt === null || s.syncedAt >= cutoff,
  );
  saveStoredSales(filtered);
}

/** Count of pending (unsynced) sales. */
export function pendingSaleCount(): number {
  return listPendingSales().length;
}
