import { Icon } from './Icon';
import { Counter } from './Counter';

/** The Snowflakes balance chip, the same everywhere (top bar, Train header). */
export function SnowCount({ value, animated = false, id }: { value: number; animated?: boolean; id?: string }) {
  return (
    <span className="chip snow-chip" title="Snowflakes">
      <span className="snow-chip-icon"><Icon name="snowflake" size={18} /></span>
      {animated ? <Counter value={value} label="Snowflakes" id={id} /> : <span className="snow-chip-num">{value}<span className="sr-only"> Snowflakes</span></span>}
    </span>
  );
}
