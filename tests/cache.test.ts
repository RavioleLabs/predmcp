import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTLCache } from '../src/cache/index.js';

describe('TTLCache', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('returns cached value within TTL', async () => {
    const cache = new TTLCache<string>(1000);
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('returns undefined after TTL expires', async () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string>(100);
    cache.set('key', 'value');
    vi.advanceTimersByTime(200);
    expect(cache.get('key')).toBeUndefined();
  });

  it('getOrFetch calls fetcher on miss and caches result', async () => {
    const cache = new TTLCache<number>(1000);
    const fetcher = vi.fn().mockResolvedValue(42);
    const result = await cache.getOrFetch('key', fetcher);
    expect(result).toBe(42);
    expect(fetcher).toHaveBeenCalledOnce();
    const result2 = await cache.getOrFetch('key', fetcher);
    expect(result2).toBe(42);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('getOrFetch calls fetcher again after TTL', async () => {
    vi.useFakeTimers();
    const cache = new TTLCache<number>(100);
    const fetcher = vi.fn().mockResolvedValue(42);
    await cache.getOrFetch('key', fetcher);
    vi.advanceTimersByTime(200);
    await cache.getOrFetch('key', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
