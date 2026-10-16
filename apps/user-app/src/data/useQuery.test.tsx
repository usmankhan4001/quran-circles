import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@qc/contracts';
import { act, createWorld, renderHookInApp, waitFor } from '../test/harness';
import { useQuery } from './useQuery';

describe('useQuery', () => {
  it('loads, then shows the data', async () => {
    const fetcher = vi.fn(async () => ['a']);
    const hook = await renderHookInApp(() => useQuery('k:1', fetcher, { persist: true }));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));
    expect(hook.result.current.data).toEqual(['a']);
    expect(hook.result.current.offline).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('waits while the key is null', async () => {
    const fetcher = vi.fn(async () => 1);
    const hook = await renderHookInApp(() => useQuery(null, fetcher));
    expect(hook.result.current.status).toBe('idle');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses a fresh copy without asking the server again', async () => {
    const world = await createWorld();
    world.services.cache.set('k:fresh', 'cached', false);
    const fetcher = vi.fn(async () => 'live');
    const hook = await renderHookInApp(() => useQuery('k:fresh', fetcher), { world });
    expect(hook.result.current.data).toBe('cached');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports an error with a code and no data when there is no saved copy', async () => {
    const fetcher = async () => {
      throw new ApiClientError(500, 'internal_error', 'r1');
    };
    const hook = await renderHookInApp(() => useQuery('k:err', fetcher));
    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.error).toMatchObject({ code: 'internal_error', requestId: 'r1' });
    expect(hook.result.current.data).toBeUndefined();
  });

  it('keeps showing the saved copy, and says so, when the server cannot be reached', async () => {
    const world = await createWorld();
    world.services.cache.set('k:saved', 'old copy', true);
    world.services.cache.invalidate('k:');
    const fetcher = async () => {
      throw new ApiClientError(0, 'network_error', null);
    };
    const hook = await renderHookInApp(() => useQuery('k:saved', fetcher, { persist: true }), {
      world,
    });
    await waitFor(() => expect(hook.result.current.fetching).toBe(false));
    expect(hook.result.current.status).toBe('success');
    expect(hook.result.current.data).toBe('old copy');
    expect(hook.result.current.offline).toBe(true);
  });

  it('does not call a saved copy "offline" when the server answered with an error', async () => {
    const world = await createWorld();
    world.services.cache.set('k:saved2', 'old copy', true);
    world.services.cache.invalidate('k:');
    const fetcher = async () => {
      throw new ApiClientError(500, 'internal_error', null);
    };
    const hook = await renderHookInApp(() => useQuery('k:saved2', fetcher, { persist: true }), {
      world,
    });
    await waitFor(() => expect(hook.result.current.error).toBeDefined());
    expect(hook.result.current.offline).toBe(false);
    expect(hook.result.current.data).toBe('old copy');
  });

  it('asks again when its data is marked out of date, once', async () => {
    const world = await createWorld();
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    const hook = await renderHookInApp(() => useQuery('me:count', fetcher), { world });
    await waitFor(() => expect(hook.result.current.data).toBe(1));
    await act(async () => {
      world.services.cache.invalidate('me:');
    });
    await waitFor(() => expect(hook.result.current.data).toBe(2));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refetches on demand', async () => {
    let n = 0;
    const hook = await renderHookInApp(() => useQuery('k:manual', async () => ++n));
    await waitFor(() => expect(hook.result.current.data).toBe(1));
    await act(async () => {
      await hook.result.current.refetch();
    });
    expect(hook.result.current.data).toBe(2);
  });
});
