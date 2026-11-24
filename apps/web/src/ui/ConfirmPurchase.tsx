import type { ReactNode } from 'react';
import { Sheet } from './Sheet';
import { sui } from '../lib/merge';

/**
 * "Are you sure?" for every purchase: what you get, what it costs, what you have, and what's
 * left after. Buy is disabled when you can't afford it.
 */
export function ConfirmPurchase({ open, item, detail, art, price, currency, balance, busy, onConfirm, onClose }: {
  open: boolean; item: string; detail?: string; art?: ReactNode; price: bigint; currency: 'SUI' | 'Snowflakes';
  balance: bigint | null; busy?: boolean; onConfirm(): void; onClose(): void;
}) {
  const fmt = (v: bigint) => (currency === 'SUI' ? sui(v) : `${v} Snowflakes`);
  const short = balance !== null && balance < price;
  return (
    <Sheet open={open} onClose={onClose} title="Confirm purchase" variant="dialog">
      <div className="confirm">
        <div className="confirm-item">
          {art && <span className="confirm-art">{art}</span>}
          <div><b>{item}</b>{detail && <small>{detail}</small>}</div>
        </div>
        <dl className="confirm-rows">
          <div><dt>Price</dt><dd>{fmt(price)}</dd></div>
          <div><dt>You have</dt><dd>{balance === null ? '…' : fmt(balance)}</dd></div>
          <div className="confirm-after"><dt>Left after</dt><dd>{balance === null ? '…' : short ? '—' : fmt(balance - price)}</dd></div>
        </dl>
        <div className="confirm-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn warm" onClick={onConfirm} disabled={busy || short || balance === null}>
            {busy ? 'Buying…' : short ? `Not enough ${currency}` : `Buy for ${fmt(price)}`}
          </button>
        </div>
        {currency === 'SUI' && <p className="hint">Gas is on us. Purchases are final.</p>}
      </div>
    </Sheet>
  );
}
