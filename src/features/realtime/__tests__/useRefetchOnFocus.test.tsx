import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useRefetchOnFocus } from '../useRefetchOnFocus';

// Mirrors expo-router's useFocusEffect: the effect is re-run whenever its identity changes (its deps are [effect]).
// mockFocus.run simulates the screen gaining focus.
const mockFocus: { run: (() => void) | null } = { run: null };
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => {
      React.useEffect(() => {
        mockFocus.run = effect;
        effect();
      }, [effect]);
    },
  };
});

function Screen({ refetch }: { refetch: () => void }) {
  // A new function on every render, as a caller would write it inline.
  useRefetchOnFocus(() => refetch());
  return <Text>screen</Text>;
}

describe('useRefetchOnFocus', () => {
  it('does not refetch on the first focus or on re-renders, and refetches on a later focus', async () => {
    const refetch = jest.fn();
    const view = await render(<Screen refetch={refetch} />);
    await act(async () => view.rerender(<Screen refetch={refetch} />));
    await act(async () => view.rerender(<Screen refetch={refetch} />));
    expect(refetch).not.toHaveBeenCalled();

    await act(async () => mockFocus.run?.());
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
