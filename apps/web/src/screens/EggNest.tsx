import { ELEMENT_COLORS } from '@flurry/art';
import { EggArt } from '../components/EggArt';
import { eggChip, nestOrder, waitsFor } from '../lib/journey';
import type { Egg } from '../lib/flurry';
import { PageHead } from '../ui/PageHead';

/** When you have more than one egg: pick which one to warm. */
export function EggNest({ eggs, selected, onPick }: { eggs: Egg[]; selected: string; onPick: (id: string) => void }) {
  return (
    <section className="nest" aria-label="Your eggs">
      <PageHead title="Your eggs" count={`${eggs.length} ${eggs.length === 1 ? 'egg' : 'eggs'}`} />
      {eggs.length > 1 && <div className="nest-row" role="radiogroup" aria-label="Choose an egg to warm">
        {nestOrder(eggs).map((e) => {
          const c = eggChip(e);
          const on = e.id === selected;
          const wait = waitsFor(eggs, e);
          return (
            <button key={e.id} role="radio" aria-checked={on} className={`nest-egg ${on ? 'is-on' : ''} ${c.ready ? 'is-ready' : ''} ${wait ? 'is-waiting' : ''}`}
              style={{ ['--el' as string]: ELEMENT_COLORS[e.element] }} onClick={() => onPick(e.id)}>
              <span className="nest-art" aria-hidden="true"><EggArt stage={Math.min(3, e.stageScores.length) as 0 | 1 | 2 | 3} element={e.element} /></span>
              <span className="nest-text"><b>{c.name}</b><small>{wait ? `Waits for your ${wait.name}` : c.status}</small></span>
              <span className="nest-pips" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i < e.stageScores.length ? 'on' : ''} />)}</span>
            </button>
          );
        })}
      </div>}
    </section>
  );
}
