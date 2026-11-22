// Prints Move hex literals for a fixed attestation so attest.move is tested against the TS encoder.
// Usage: tsx scripts/gen-vector.ts [profileId] [nonce score snowflakes]...
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toHex } from '@mysten/sui/utils';
import { signAttestation } from '../src/attestation';
import { signLore } from '../src/lore';

const kp = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
if (process.argv[2] === '--lore') {
  const { message, signature } = await signLore(
    { yetiId: process.argv[3], name: process.argv[4] ?? 'Pebble', loreBlob: 'L1', cardBlob: 'C1', cardUrl: 'https://x/C1', expiresMs: 1_800_000_000_000n },
    kp,
  );
  console.log(`const LORE_MSG: vector<u8> = x"${toHex(message)}";`);
  console.log(`const LORE_SIG: vector<u8> = x"${toHex(signature)}";`);
  process.exit(0);
}
const profileId = process.argv[2] ?? '0xcafe';
const triples = process.argv.slice(3).map(Number);
const runs = triples.length ? Array.from({ length: triples.length / 3 }, (_, i) => triples.slice(i * 3, i * 3 + 3)) : [[0, 812, 81]];

console.log(`const PK: vector<u8> = x"${toHex(kp.getPublicKey().toRawBytes())}";`);
for (const [nonce, score, snow] of runs) {
  const { message, signature } = await signAttestation(
    { profileId, nonce: BigInt(nonce), purpose: 0, game: 0, score, snowflakes: BigInt(snow), expiresMs: 1_800_000_000_000n },
    kp,
  );
  console.log(`// nonce ${nonce} score ${score} snowflakes ${snow}`);
  console.log(`const MSG_${nonce}: vector<u8> = x"${toHex(message)}";`);
  console.log(`const SIG_${nonce}: vector<u8> = x"${toHex(signature)}";`);
}
