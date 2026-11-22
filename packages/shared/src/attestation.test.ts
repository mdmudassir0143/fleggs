import { describe, expect, test } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encodeAttestation, signAttestation, type Attestation } from './attestation';

const a: Attestation = {
  profileId: '0x' + 'ca'.padStart(64, '0'),
  nonce: 0n,
  purpose: 0,
  game: 0,
  score: 812,
  snowflakes: 81n,
  expiresMs: 1_800_000_000_000n,
};
const kp = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));

describe('attestation', () => {
  test('encodes 13-byte prefix then 32+8+1+1+4+8+8 bytes', () => {
    const m = encodeAttestation(a);
    expect(m.length).toBe(13 + 62);
    expect(new TextDecoder().decode(m.slice(0, 13))).toBe('FLURRY_ATT_V1');
  });

  test('signature verifies with ed25519 public key', async () => {
    const { message, signature } = await signAttestation(a, kp);
    expect(signature.length).toBe(64);
    expect(await kp.getPublicKey().verify(message, signature)).toBe(true);
  });

  test('changing score changes the message', () => {
    expect(encodeAttestation({ ...a, score: 813 })).not.toEqual(encodeAttestation(a));
  });
});
