import type { Yeti } from '../lib/flurry';
import { mergeReadiness } from '../lib/train';

/** Whether this yeti can be merged yet: every trait must be maxed for its level. */
export function MergeBadge({ yeti }: { yeti: Yeti }) {
  if (yeti.level >= 5) return <span className="merge-badge is-max">Elder Yeti, the top level</span>;
  const m = mergeReadiness(yeti);
  return m.ready
    ? <span className="merge-badge is-ready">Ready to merge</span>
    : <span className="merge-badge">{m.trainingsLeft} {m.trainingsLeft === 1 ? 'training' : 'trainings'} to merge</span>;
}
