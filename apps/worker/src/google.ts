/** Verifies a Google ID token (RS256) against Google's published keys. No libraries; WebCrypto only. */
type Jwks = { keys: (JsonWebKey & { kid?: string })[] };
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const SKEW_S = 300;

const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

export async function googleJwks(): Promise<Jwks> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cf: { cacheTtl: 3600 } } as RequestInit);
  if (!r.ok) throw new Error('could not load Google keys');
  return r.json();
}

export async function verifyGoogleIdToken(jwt: string, o: { clientId: string; now: number; jwks?: () => Promise<Jwks> }): Promise<{ email: string; emailVerified: boolean; sub: string }> {
  const [h, p, s] = String(jwt).split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const head = JSON.parse(new TextDecoder().decode(fromB64u(h))) as { alg?: string; kid?: string };
  if (head.alg !== 'RS256') throw new Error('unexpected algorithm');
  const jwk = (await (o.jwks ?? googleJwks)()).keys.find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64u(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('bad signature');
  const c = JSON.parse(new TextDecoder().decode(fromB64u(p))) as { iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean | string; sub?: string };
  if (!c.iss || !ISSUERS.has(c.iss)) throw new Error('wrong issuer');
  if (c.aud !== o.clientId) throw new Error('wrong audience');
  if (!c.exp || c.exp + SKEW_S < o.now / 1000) throw new Error('token expired');
  return { email: c.email ?? '', emailVerified: c.email_verified === true || c.email_verified === 'true', sub: c.sub ?? '' };
}

/** The game address a zkLogin token controls, as Enoki derives it (same salt the wallet uses). */
export async function enokiAddressFor(jwt: string, apiKey: string): Promise<string> {
  const r = await fetch('https://api.enoki.mystenlabs.com/v1/zklogin', { headers: { Authorization: `Bearer ${apiKey}`, 'zklogin-jwt': jwt } });
  if (!r.ok) throw new Error('could not resolve the account');
  const j = (await r.json()) as { data?: { address?: string } };
  if (!j.data?.address) throw new Error('could not resolve the account');
  return j.data.address;
}
