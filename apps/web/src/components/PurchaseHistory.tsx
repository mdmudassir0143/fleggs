import { useEffect, useState } from 'react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { getShop } from '../lib/flurry';
import { explorerTx, type HistoryRow } from '../lib/history';
import { useHistory } from '../lib/useHistory';
import { SnowLoader } from '../ui/SnowLoader';
import { Icon } from '../ui/Icon';

const HISTORY_ICON: Record<string, string> = { buy_extra_play: 'play', skip_training: 'clock', merge: 'merge' };
const when = (t: number) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const FIRST = 5;

/** Your receipts: every egg, extra play, skip and merge you paid for, each linked to Suiscan. Loads when `active`. */
export function PurchaseHistory({ address, active }: { address: string; active: boolean }) {
  const dAppKit = useDAppKit();
  const [flakePrice, setFlakePrice] = useState<number | null>(null);
  const history = useHistory(address, flakePrice ?? 400);
  const [showAll, setShowAll] = useState(false);

  // The Snowflake egg's price labels those receipts; fetch it once, then load the history.
  useEffect(() => {
    if (!active || flakePrice !== null) return;
    getShop(dAppKit.getClient('testnet') as never).then((s) => setFlakePrice(s.snowflakeEggPrice)).catch(() => setFlakePrice(400));
  }, [active, flakePrice, dAppKit]);
  // Fresh every time it opens, so a purchase made a moment ago is already here.
  useEffect(() => { if (active && flakePrice !== null) void history.load(); }, [active, flakePrice]); // eslint-disable-line react-hooks/exhaustive-deps

  if (history.error) return <div className="history-empty"><p>{history.error}</p><button className="btn" onClick={() => void history.load()}>Try again</button></div>;
  if (!history.rows) return <SnowLoader label="Finding your receipts…" size="sm" />;
  if (history.rows.length === 0) return <div className="history-empty"><p><b>No purchases yet.</b> Eggs, extra plays, skips and merges you pay for will show up here.</p></div>;
  return (
    <>
      <ul className="history-list">
        {(showAll ? history.rows : history.rows.slice(0, FIRST)).map((r: HistoryRow) => (
          <li key={r.digest}>
            <span className="h-icon" aria-hidden="true"><Icon name={HISTORY_ICON[r.fn] ?? 'egg'} size={20} /></span>
            <span className="h-text"><b>{r.label}</b><small>{when(r.at)}</small></span>
            <span className={`h-cost ${r.cost === 'Free' ? 'is-free' : ''}`}>{r.cost === 'Free' ? 'Free' : `−${r.cost}`}</span>
            <a className="h-link" href={explorerTx(r.digest)} target="_blank" rel="noreferrer" aria-label={`View ${r.label} on Suiscan`}><Icon name="external" size={16} /></a>
          </li>
        ))}
      </ul>
      {!showAll && history.rows.length > FIRST && <button className="btn history-more" onClick={() => setShowAll(true)}>Show all {history.rows.length}</button>}
    </>
  );
}
