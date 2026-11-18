import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ResendCodeButton } from '../ResendCodeButton';

describe('ResendCodeButton', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits a minute before allowing a resend, then restarts the wait', async () => {
    const onResend = jest.fn();
    await render(<ResendCodeButton onResend={onResend} loading={false} />);

    expect(screen.getByRole('button', { name: 'Send a new code in 60s' })).toBeDisabled();

    for (let i = 0; i < 60; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Send a new code in 60s' })).toBeDisabled();
  });
});
