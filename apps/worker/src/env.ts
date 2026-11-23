import type { GasPool } from './sponsor/durable';

export type Env = {
  RUNS: KVNamespace;
  GAS_POOL: DurableObjectNamespace<GasPool>;
  ATTESTOR_SK: string;
  SPONSOR_SK: string;
  ADMIN_TOKEN: string;
  ALLOWED_ORIGINS: string;
  AI: Ai;
  WALRUS_PUBLISHER: string;
  WALRUS_AGGREGATOR: string;
  WALRUS_EPOCHS: string;
  /** Google sign-in client the game uses (tokens must be for this audience). */
  GOOGLE_CLIENT_ID: string;
  /** Enoki public API key, to look up the game address of a sign-in token. */
  ENOKI_API_KEY: string;
  /** Resend (transactional email) key and sender, e.g. "Flurry Eggs <hello@fleggs.online>". */
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  /** Other gas payers to include in Watcher, as "Label=0xaddress" comma-separated. */
  GAS_PAYERS?: string;
};
