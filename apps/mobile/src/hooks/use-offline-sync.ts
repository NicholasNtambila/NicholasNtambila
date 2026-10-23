/**
 * useOfflineSync — hook that:
 *  1. Detects connectivity via a lightweight fetch ping (no extra package needed).
 *  2. Attempts to flush all pending SQLite sales to Supabase whenever online.
 *  3. Returns { isOnline, pendingCount, syncNow } for UI display.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../../lib/supabase';
import {
  incrementRetry,
  listPendingSales,
  markSynced,
  pendingSaleCount,
  pruneOldSynced,
} from '../../lib/offline-queue';

/** Probe URL — lightweight, cacheable endpoint to check connectivity. */
const PING_URL = 'https://www.gstatic.com/generate_204';
const PING_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 15_000;
const MAX_RETRIES = 5;

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(PING_URL, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

export interface OfflineSyncState {
  /** Whether the device has internet access right now. */
  isOnline: boolean;
  /** Number of sales waiting to be synced. */
  pendingCount: number;
  /** Trigger an immediate sync attempt (no-op when offline). */
  syncNow: () => Promise<void>;
  /** True while a sync is in progress. */
  syncing: boolean;
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(() => pendingSaleCount());
  const [syncing, setSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const refreshCount = useCallback(() => {
    setPendingCount(pendingSaleCount());
  }, []);

  const syncNow = useCallback(async () => {
    if (!supabase || isSyncingRef.current) return;
    const pending = listPendingSales();
    if (pending.length === 0) return;

    isSyncingRef.current = true;
    setSyncing(true);

    for (const sale of pending) {
      if (sale.retryCount >= MAX_RETRIES) continue; // give up after 5 attempts
      try {
        const { error } = await supabase.rpc('post_sale', {
          target_tenant_id: sale.tenantId,
          target_branch_id: sale.branchId,
          request_idempotency_key: sale.payload.idempotencyKey,
          sale_items: sale.payload.items,
          sale_payments: sale.payload.payments,
        });
        if (error) {
          incrementRetry(sale.id);
        } else {
          markSynced(sale.id);
        }
      } catch {
        incrementRetry(sale.id);
      }
    }

    pruneOldSynced(30);
    refreshCount();
    isSyncingRef.current = false;
    setSyncing(false);
  }, [refreshCount]);

  // Poll connectivity and auto-sync on reconnect
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const online = await checkConnectivity();
      if (cancelled) return;
      setIsOnline(online);
      if (online) {
        await syncNow();
      }
    }

    void poll(); // immediate check on mount
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [syncNow]);

  return { isOnline, pendingCount, syncNow, syncing };
}
