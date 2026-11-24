import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/** Pill tab bar (Shop, Earn). Arrow keys move between tabs; pair with a role="tabpanel" using `${idBase}-panel-${id}`. */
export function Tabs<T extends string>({ tabs, value, onChange, label, idBase }: {
  tabs: { id: T; label: ReactNode; badge?: number }[]; value: T; onChange: (id: NoInfer<T>) => void; label: string; idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = (i + d + tabs.length) % tabs.length;
    onChange(tabs[n].id); refs.current[n]?.focus();
  };
  return (
    <div className="shop-tabs" role="tablist" aria-label={label} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={(b) => { refs.current[i] = b; }} role="tab" id={`${idBase}-tab-${t.id}`} aria-controls={`${idBase}-panel-${t.id}`}
          aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} className={`shop-tab ${value === t.id ? 'is-on' : ''}`}
          onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>
          {t.label}{!!t.badge && <span className="tab-badge"><span className="sr-only">, </span>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
