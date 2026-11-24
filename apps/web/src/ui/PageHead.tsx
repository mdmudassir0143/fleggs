import type { ReactNode } from 'react';

/** Page title pill on the left, a count or value pill on the right (the Den style, everywhere). */
export function PageHead({ title, count, children }: { title: string; count?: ReactNode; children?: ReactNode }) {
  return (
    <header className="den-head page-head">
      <h2>{title}</h2>
      <span className="den-head-right">
        {children}
        {count !== undefined && <span className="den-count">{count}</span>}
      </span>
    </header>
  );
}
