import { useEffect, useState } from 'react';
import type { Yeti } from '../lib/flurry';
import { formatDuration, mergeReadiness } from '../lib/train';

/** A yeti's status on its card: training timer, ready to merge, or trainings left to merge. */
export function YetiStatus({ yeti }: { yeti: Yeti }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!yeti.training) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [yeti.training]);
  if (yeti.training) {
    const left = Math.max(0, yeti.training.readyAt - now);
    return <span className="yeti-status is-training">{left > 0 ? formatDuration(left) : 'Training done'}</span>;
  }
  if (yeti.level >= 5) return null;
  const m = mergeReadiness(yeti);
  return m.ready
    ? <span className="yeti-status is-ready">Ready to merge</span>
    : <span className="yeti-status">{m.trainingsLeft} to merge</span>;
}
