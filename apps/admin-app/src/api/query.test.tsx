import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from './query';

describe('useQuery', () => {
  it('loads and then holds the data', async () => {
    const { result } = renderHook(() => useQuery(async () => 'hello', []));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('hello');
  });

  it('keeps the error and offers a reload that can recover', async () => {
    let attempt = 0;
    const { result } = renderHook(() =>
      useQuery(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('first');
        return 'second';
      }, []),
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('second');
  });

  it('keeps the last good data while a reload is under way and after it fails', async () => {
    let attempt = 0;
    const { result } = renderHook(() =>
      useQuery(async () => {
        attempt += 1;
        if (attempt === 2) throw new Error('later');
        return `v${attempt}`;
      }, []),
    );
    await waitFor(() => expect(result.current.data).toBe('v1'));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.data).toBe('v1');
  });

  it('loads again when its inputs change and ignores the older answer', async () => {
    let release: (v: string) => void = () => undefined;
    const slow = new Promise<string>((resolve) => {
      release = resolve;
    });
    const { result, rerender } = renderHook(
      ({ id }) => useQuery(() => (id === 'a' ? slow : Promise.resolve('b-data')), [id]),
      {
        initialProps: { id: 'a' },
      },
    );
    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.data).toBe('b-data'));
    await act(async () => {
      release('a-data');
      await slow;
    });
    expect(result.current.data).toBe('b-data');
  });

  it('waits while disabled', async () => {
    const fetcher = vi.fn(async () => 'x');
    const { result, rerender } = renderHook(({ on }) => useQuery(fetcher, [], { enabled: on }), {
      initialProps: { on: false },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
    rerender({ on: true });
    await waitFor(() => expect(result.current.data).toBe('x'));
  });
});

describe('useMutation', () => {
  it('resolves with the result and records success', async () => {
    const { result } = renderHook(() => useMutation(async (n: number) => n * 2));
    let value: number | undefined;
    await act(async () => {
      value = await result.current.run(4);
    });
    expect(value).toBe(8);
    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe(8);
  });

  it('resolves with undefined and keeps the error instead of throwing', async () => {
    const boom = new Error('refused');
    const { result } = renderHook(() =>
      useMutation(async () => {
        throw boom;
      }),
    );
    let value: unknown = 'unset';
    await act(async () => {
      value = await result.current.run();
    });
    expect(value).toBeUndefined();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(boom);
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
