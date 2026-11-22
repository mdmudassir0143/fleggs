import { bcs } from '@mysten/sui/bcs';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

/** A referee-signed game result. Must match `flurry::attest` byte for byte. */
export type Attestation = {
  profileId: string;
  nonce: bigint;
  purpose: number;
  game: number;
  score: number;
  snowflakes: bigint;
  expiresMs: bigint;
};

const PREFIX = new TextEncoder().encode('FLURRY_ATT_V1');

const AttestationBcs = bcs.struct('Attestation', {
  profile_id: bcs.Address,
  nonce: bcs.u64(),
  purpose: bcs.u8(),
  game: bcs.u8(),
  score: bcs.u32(),
  snowflakes: bcs.u64(),
  expires_ms: bcs.u64(),
});

export function encodeAttestation(a: Attestation): Uint8Array {
  const body = AttestationBcs.serialize({
    profile_id: a.profileId,
    nonce: a.nonce,
    purpose: a.purpose,
    game: a.game,
    score: a.score,
    snowflakes: a.snowflakes,
    expires_ms: a.expiresMs,
  }).toBytes();
  const out = new Uint8Array(PREFIX.length + body.length);
  out.set(PREFIX);
  out.set(body, PREFIX.length);
  return out;
}

/** Raw ed25519 signature over the encoded message (no Sui intent prefix). */
export async function signAttestation(a: Attestation, kp: Ed25519Keypair) {
  const message = encodeAttestation(a);
  const signature = await kp.sign(message);
  return { message, signature };
}
