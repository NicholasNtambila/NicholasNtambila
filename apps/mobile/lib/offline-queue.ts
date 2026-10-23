/**
 * Offline Queue — persists pending cashier sales in SQLite when Supabase
 * is unreachable and automatically syncs them when connectivity is restored.
 *
 * Schema
 * ------
 * pending_sales (
 *   id            TEXT PRIMARY KEY,
 *   tenant_id     TEXT NOT NULL,
 *   branch_id     TEXT NOT NULL,
 *   payload       TEXT NOT NULL,   -- JSON: { items, payments, idempotencyKey }
 *   created_at    INTEGER NOT NULL, -- Unix ms
 *   synced_at     INTEGER,          -- NULL until confirmed by Supabase
 *   retry_count   INTEGER NOT NULL DEFAULT 0
 * )
 */

import * as SQLite from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DB initialisation (lazy singleton)
// ---------------------------------------------------------------------------

let _db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('sunga_offline.db');
    _db.execSync(`
      CREATE TABLE IF NOT EXISTS pending_sales (
        id          TEXT PRIMARY KEY,
        tenant_id   TEXT NOT NULL,
        branch_id   TEXT NOT NULL,
        payload     TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        synced_at   INTEGER,
        retry_count INTEGER NOT NULL DEFAULT 0
      );
    `);
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Persist a sale record locally for later sync. */
export function enqueueSale(
  id: string,
  tenantId: string,
  branchId: string,
  payload: SalePayload,
): void {
  const db = getDb();
  db.runSync(
    `INSERT OR IGNORE INTO pending_sales
       (id, tenant_id, branch_id, payload, created_at, synced_at, retry_count)
     VALUES (?, ?, ?, ?, ?, NULL, 0)`,
    id,
    tenantId,
    branchId,
    JSON.stringify(payload),
    Date.now(),
  );
}

/** Return all unsynced (pending) sales ordered oldest-first. */
export function listPendingSales(): PendingSale[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    tenant_id: string;
    branch_id: string;
    payload: string;
    created_at: number;
    synced_at: number | null;
    retry_count: number;
  }>(
    `SELECT * FROM pending_sales WHERE synced_at IS NULL ORDER BY created_at ASC`,
  );

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    branchId: r.branch_id,
    payload: JSON.parse(r.payload) as SalePayload,
    createdAt: r.created_at,
    syncedAt: r.synced_at,
    retryCount: r.retry_count,
  }));
}

/** Mark a sale as successfully synced. */
export function markSynced(id: string): void {
  const db = getDb();
  db.runSync(
    `UPDATE pending_sales SET synced_at = ? WHERE id = ?`,
    Date.now(),
    id,
  );
}

/** Increment the retry counter for a failed sync attempt. */
export function incrementRetry(id: string): void {
  const db = getDb();
  db.runSync(
    `UPDATE pending_sales SET retry_count = retry_count + 1 WHERE id = ?`,
    id,
  );
}

/** Remove synced records older than `maxAgeDays` days (default 30). */
export function pruneOldSynced(maxAgeDays = 30): void {
  const db = getDb();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  db.runSync(
    `DELETE FROM pending_sales WHERE synced_at IS NOT NULL AND synced_at < ?`,
    cutoff,
  );
}

/** Count of pending (unsynced) sales — useful for badge / UI indicator. */
export function pendingSaleCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM pending_sales WHERE synced_at IS NULL`,
  );
  return row?.n ?? 0;
}
