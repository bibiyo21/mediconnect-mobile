import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ApiError } from '@mediconnect/api-client';
import SignIn from '../(auth)/sign-in';
import { RegistrationDraftProvider } from '@/features/auth/RegistrationDraft';
import { signIn } from '@/features/auth/api';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true }) }));
jest.mock('@/features/auth/api', () => ({ signIn: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return (
    <QueryClientProvider client={client}>
      <RegistrationDraftProvider>{children}</RegistrationDraftProvider>
    </QueryClientProvider>
  );
}

describe('Sign in screen', () => {
  beforeEach(() => jest.mocked(signIn).mockReset());

  it('shows accessible validation errors and does not call the API for an empty form', async () => {
    await render(<SignIn />, { wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address or mobile number.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows the server message when the credentials are rejected', async () => {
    jest.mocked(signIn).mockRejectedValue(new ApiError(422, { message: 'These credentials do not match our records.', code: 'INVALID_CREDENTIALS', errors: {} }));
    await render(<SignIn />, { wrapper });

    await fireEvent.changeText(screen.getByLabelText('Email or mobile number'), 'juan@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password1');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('juan@example.com', 'wrong-password1'));
    expect(await screen.findByText('These credentials do not match our records.')).toBeOnTheScreen();
  });
});
