/** JSON POST to the game Worker with errors written for players, not developers. */
export function createPost(baseUrl: string, doFetch: typeof fetch = (...a) => fetch(...a)) {
  return async function post(path: string, body: unknown): Promise<any> {
    let r: Response;
    try {
      r = await doFetch(baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new Error("Can't reach the game server. Check your connection and try again.");
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? `The game server didn't respond (${r.status}). Try again.`);
    return j;
  };
}
