import { useCallback, useState } from 'react';
import { TESTNET } from '@flurry/shared';
import { fetchHistory, type HistoryRow } from './history';

/** The player's purchase history from Sui GraphQL, loaded on demand. */
export function useHistory(address: string, snowflakeEggPrice: number) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await fetchHistory(address, [...new Set([TESTNET.shopTypesId, TESTNET.latestPackageId])], snowflakeEggPrice)); }
    catch { setError('Your history could not be loaded. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, [address, snowflakeEggPrice]);
  return { rows, error, loading, load };
}
