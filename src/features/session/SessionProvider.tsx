import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { session } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { hasCookieSession } from '@/features/auth/api';

/** Current session state (restoring, signedIn, signedOut + why). */
export function useSession() {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Signing out (by the user or because the session expired) drops every
    // cached response so no account data outlives the session.
    const unsubscribe = session.subscribe((state) => {
      if (state.status === 'signedOut') queryClient.clear();
    });
    session.restore(hasCookieSession).catch(() => session.signOut(null));
    return unsubscribe;
  }, []);

  return children;
}
