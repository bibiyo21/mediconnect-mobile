import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { OtpChallenge } from './api';

/**
 * Sign-in and registration steps share state in memory only. Contact details,
 * verification tokens and MFA challenge ids are never put in route params
 * (they would show up in web URLs and navigation history) and never persisted.
 */
interface Draft {
  mfaChallengeId?: string;
  contact?: string;
  challenge?: OtpChallenge;
  verificationToken?: string;
}

const Context = createContext<{ draft: Draft; update: (patch: Partial<Draft>) => void; reset: () => void } | null>(null);

export function RegistrationDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({});
  const value = useMemo(
    () => ({ draft, update: (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), reset: () => setDraft({}) }),
    [draft],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRegistrationDraft() {
  const value = useContext(Context);
  if (!value) throw new Error('useRegistrationDraft outside RegistrationDraftProvider');
  return value;
}
