import { act, renderHook } from '@testing-library/react-native';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits 300 ms after the last change, so a burst of typing settles once', async () => {
    const seen: string[] = [];
    const { rerender, result } = await renderHook(({ value }: { value: string }) => {
      const settled = useDebouncedValue(value);
      if (seen.at(-1) !== settled) seen.push(settled);
      return settled;
    }, { initialProps: { value: '' } });

    for (const value of ['c', 'ca', 'car', 'card']) {
      await rerender({ value });
      await act(async () => {
        jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50);
      });
    }
    expect(result.current).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current).toBe('card');
    expect(seen).toEqual(['', 'card']);
  });
});
