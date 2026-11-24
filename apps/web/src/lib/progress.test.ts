import { expect, test } from 'vitest';
import { progress, type Snapshot } from './progress';

const base: Snapshot = { address: '0x1', profile: null, eggs: [], yetis: [] };
const profile = { id: 'p', element: 0, snowflakes: 0n, nonce: 0n };
const egg = (n: number) => ({ id: 'e', element: 0, stageScores: Array(n).fill(1) });
const yeti = { id: 'y', level: 1, elements: [0], variants: [0, 0, 0], name: 'Y', cardUrl: '', named: false };

test('every step of the hatch flow moves progress forward', () => {
  const steps: Snapshot[] = [
    base,
    { ...base, profile, eggs: [egg(0)] },
    { ...base, profile, eggs: [egg(1)] },
    { ...base, profile, eggs: [egg(2)] },
    { ...base, profile, eggs: [egg(3)] },
    { ...base, profile, eggs: [], yetis: [yeti] },
  ];
  for (let i = 1; i < steps.length; i++) expect(progress(steps[i])).toBeGreaterThan(progress(steps[i - 1]));
});

test('saving lore onto a yeti moves progress forward', () => {
  const unnamed = { ...base, profile, eggs: [], yetis: [yeti] };
  const named = { ...base, profile, eggs: [], yetis: [{ ...yeti, named: true }] };
  expect(progress(named)).toBeGreaterThan(progress(unnamed));
});
