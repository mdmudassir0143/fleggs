import { bcs } from '@mysten/sui/bcs';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

/** Referee-signed lore for a hatched yeti. Must match `flurry::attest::verify_lore` byte for byte. */
export type Lore = {
  yetiId: string;
  name: string;
  loreBlob: string;
  cardBlob: string;
  cardUrl: string;
  expiresMs: bigint;
};

const PREFIX = new TextEncoder().encode('FLURRY_LORE_V1');

const LoreBcs = bcs.struct('Lore', {
  yeti_id: bcs.Address,
  name: bcs.string(),
  lore_blob: bcs.string(),
  card_blob: bcs.string(),
  card_url: bcs.string(),
  expires_ms: bcs.u64(),
});

export function encodeLore(l: Lore): Uint8Array {
  const body = LoreBcs.serialize({
    yeti_id: l.yetiId,
    name: l.name,
    lore_blob: l.loreBlob,
    card_blob: l.cardBlob,
    card_url: l.cardUrl,
    expires_ms: l.expiresMs,
  }).toBytes();
  const out = new Uint8Array(PREFIX.length + body.length);
  out.set(PREFIX);
  out.set(body, PREFIX.length);
  return out;
}

export async function signLore(l: Lore, kp: Ed25519Keypair) {
  const message = encodeLore(l);
  return { message, signature: await kp.sign(message) };
}
