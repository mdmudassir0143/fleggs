import { beforeAll, describe, expect, test } from 'vitest';
import { verifyGoogleIdToken } from './google';

const CLIENT = 'client-123.apps.googleusercontent.com';
const now = 1_800_000_000_000;
let keys: CryptoKeyPair, jwk: JsonWebKey;
const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function token(claims: Record<string, unknown>, kid = 'k1') {
  const head = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })), body = b64u(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
const good = () => ({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '42', email: 'Lofi@Snow.example', email_verified: true, exp: now / 1000 + 600, iat: now / 1000 });
const jwks = async () => ({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] });

beforeAll(async () => {
  keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  jwk = await crypto.subtle.exportKey('jwk', keys.publicKey) as JsonWebKey;
});

describe('Google ID tokens', () => {
  test('a valid token gives the verified email', async () => {
    expect(await verifyGoogleIdToken(await token(good()), { clientId: CLIENT, now, jwks })).toEqual({ email: 'Lofi@Snow.example', emailVerified: true, sub: '42' });
  });
  test('wrong audience, issuer, expiry or signature are refused', async () => {
    await expect(verifyGoogleIdToken(await token({ ...good(), aud: 'other' }), { clientId: CLIENT, now, jwks })).rejects.toThrow();
    await expect(verifyGoogleIdToken(await token({ ...good(), iss: 'evil.example' }), { clientId: CLIENT, now, jwks })).rejects.toThrow();
    await expect(verifyGoogleIdToken(await token({ ...good(), exp: now / 1000 - 3600 }), { clientId: CLIENT, now, jwks })).rejects.toThrow();
    const t = await token(good());
    const tampered = t.split('.').map((p, i) => (i === 1 ? b64u(JSON.stringify({ ...good(), email: 'admin@x.io' })) : p)).join('.');
    await expect(verifyGoogleIdToken(tampered, { clientId: CLIENT, now, jwks })).rejects.toThrow();
    await expect(verifyGoogleIdToken(await token(good(), 'unknown-kid'), { clientId: CLIENT, now, jwks })).rejects.toThrow();
  });
});
