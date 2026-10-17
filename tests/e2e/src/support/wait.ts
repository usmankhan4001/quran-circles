/** Polls `probe` until it returns a value that is not null or undefined, or fails after `timeoutMs`. */
export async function eventually<T>(
  what: string,
  probe: () => Promise<T | null | undefined>,
  timeoutMs = 30_000,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== null && value !== undefined) return value;
    if (Date.now() > deadline)
      throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
    await new Promise((done) => setTimeout(done, intervalMs));
  }
}
