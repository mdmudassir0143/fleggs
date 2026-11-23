import { createAccess } from './access';
import { enokiAddressFor, verifyGoogleIdToken } from './google';
import type { Env } from './env';

/** The access rules wired to real Google keys and Enoki. */
export function accessFor(env: Env) {
  return createAccess({
    kv: env.RUNS as never,
    now: () => Date.now(),
    verifyGoogle: (jwt) => verifyGoogleIdToken(jwt, { clientId: env.GOOGLE_CLIENT_ID, now: Date.now() }),
    addressFor: (jwt) => enokiAddressFor(jwt, env.ENOKI_API_KEY),
  });
}
