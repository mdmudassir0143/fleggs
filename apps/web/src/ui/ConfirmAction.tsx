import type { ReactNode } from 'react';
import { Sheet } from './Sheet';

/** "Are you sure?" for actions that aren't plain purchases (sell, list, stake, unstake): what happens, in rows. */
export function ConfirmAction({ open, title, art, rows, note, confirm, busy, danger, onConfirm, onClose }: {
  open: boolean; title: string; art?: ReactNode; rows: [string, string][]; note?: string; confirm: string;
  busy?: boolean; danger?: boolean; onConfirm(): void; onClose(): void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} variant="dialog">
      <div className="confirm">
        {art && <div className="confirm-item"><span className="confirm-art">{art}</span></div>}
        <dl className="confirm-rows">
          {rows.map(([k, v], i) => <div key={k} className={i === rows.length - 1 ? 'confirm-after' : ''}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {note && <p className="hint confirm-note">{note}</p>}
        <div className="confirm-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'warm' : 'warm'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirm}</button>
        </div>
      </div>
    </Sheet>
  );
}
