import { expect, test } from 'vitest';
import { bcs } from '@mysten/sui/bcs';
import { FREE_PLAYS, playsLeft, PlaysBcs } from './plays';

test('Plays BCS matches the Move struct', () => {
  const bytes = bcs.struct('P', { day: bcs.u64(), used: bcs.u8(), credits: bcs.u64() }).serialize({ day: 5n, used: 2, credits: 1n }).toBytes();
  expect(PlaysBcs.parse(bytes)).toEqual({ day: '5', used: 2, credits: '1' });
});

test('plays left: free count resets on a new day, credits carry over', () => {
  expect(FREE_PLAYS).toBe(2);
  expect(playsLeft(null, 10)).toEqual({ free: 2, credits: 0, total: 2 });
  expect(playsLeft({ day: 10, used: 2, credits: 0 }, 10)).toEqual({ free: 0, credits: 0, total: 0 });
  expect(playsLeft({ day: 10, used: 2, credits: 3 }, 10)).toEqual({ free: 0, credits: 3, total: 3 });
  expect(playsLeft({ day: 9, used: 2, credits: 1 }, 10)).toEqual({ free: 2, credits: 1, total: 3 });
});
