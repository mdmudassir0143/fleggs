export type WalrusConfig = {
  publisher: string;
  aggregator: string;
  epochs: number;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
};

const RETRIES = 3;
const TIMEOUT_MS = 25_000;

/**
 * Stores bytes on Walrus testnet and returns the blob ID.
 * `publisher` may list several public publishers (comma-separated). Public publishers pay for
 * storage from their own WAL and sometimes run dry ("could not find WAL coins"), so we try them
 * in order: a single publisher gets 3 attempts, a list gets one attempt each.
 */
export async function uploadBlob(bytes: Uint8Array, contentType: string, cfg: WalrusConfig): Promise<string> {
  const doFetch = cfg.fetch ?? fetch;
  const sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const publishers = cfg.publisher.split(',').map((p) => p.trim()).filter(Boolean);
  const attempts = publishers.length === 1 ? Array(RETRIES).fill(publishers[0]) as string[] : publishers;
  let last = '';
  for (let i = 0; i < attempts.length; i++) {
    const pub = attempts[i];
    try {
      const res = await doFetch(`${pub}/v1/blobs?epochs=${cfg.epochs}`, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const j = (await res.json()) as { newlyCreated?: { blobObject?: { blobId?: string } }; alreadyCertified?: { blobId?: string } };
        const id = j.newlyCreated?.blobObject?.blobId ?? j.alreadyCertified?.blobId;
        if (id) return id;
        last = `${pub}: no blob id in response`;
      } else last = `${pub}: HTTP ${res.status} (${bytes.length} B ${contentType}): ${(await res.text().catch(() => '')).slice(0, 200)}`;
    } catch (e) {
      last = `${pub}: ${(e as Error).message}`;
    }
    console.warn('[walrus] upload attempt failed', last);
    if (publishers.length === 1 && i < attempts.length - 1) await sleep(500 * 2 ** i);
  }
  throw new Error(publishers.length === 1 ? `Walrus upload failed: ${last}` : `Walrus upload failed on all ${publishers.length} publishers; last: ${last}`);
}

export function blobUrl(blobId: string, cfg: Pick<WalrusConfig, 'aggregator'>): string {
  return `${cfg.aggregator}/v1/blobs/${blobId}`;
}
