import { expect, test } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encodeLore, signLore, type Lore } from './lore';

const l: Lore = {
  yetiId: '0x' + 'ca'.padStart(64, '0'),
  name: 'Pebble',
  loreBlob: 'L1',
  cardBlob: 'C1',
  cardUrl: 'https://x/C1',
  expiresMs: 1_800_000_000_000n,
};

test('prefix is FLURRY_LORE_V1', () => {
  expect(new TextDecoder().decode(encodeLore(l).slice(0, 14))).toBe('FLURRY_LORE_V1');
});

test('strings are BCS length-prefixed', () => {
  const m = encodeLore(l);
  // prefix 14 + address 32, then name: length byte 6 + "Pebble"
  expect(m[46]).toBe(6);
  expect(new TextDecoder().decode(m.slice(47, 53))).toBe('Pebble');
  expect(m.length).toBe(14 + 32 + 7 + 3 + 3 + 13 + 8);
});

test('signature verifies', async () => {
  const kp = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
  const { message, signature } = await signLore(l, kp);
  expect(await kp.getPublicKey().verify(message, signature)).toBe(true);
});
