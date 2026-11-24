import { Suspense, lazy } from 'react';
import { BootLoader } from '../components/BootLoader';

const Story = lazy(() => import('../story/Story'));

/** Signed-out home: the scroll story (lazy-loaded); the egg loader shows while it loads. */
export function Landing() {
  return (
    <Suspense fallback={<BootLoader label="Warming up…" />}>
      <Story />
    </Suspense>
  );
}
