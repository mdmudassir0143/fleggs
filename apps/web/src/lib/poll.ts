/** Re-reads chain state until `done` holds (fullnode indexes a few hundred ms after execution). */
export async function pollUntil<T>(
  read: () => Promise<T>,
  done: (v: T) => boolean,
  { tries = 10, delayMs = 400 } = {},
): Promise<T> {
  let v = await read();
  for (let i = 1; i < tries && !done(v); i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    v = await read();
  }
  return v;
}
