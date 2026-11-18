import { useEffect, useState } from 'react';
import { Button } from './Button';

const COOLDOWN_SECONDS = 60;

/**
 * "Send a new code" with the same one-minute wait the server enforces, so people
 * see when they can try again instead of hitting a rate-limit error.
 */
export function ResendCodeButton({ onResend, loading }: { onResend: () => void; loading: boolean }) {
  const [remaining, setRemaining] = useState(COOLDOWN_SECONDS);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return (
    <Button
      label={remaining > 0 ? `Send a new code in ${remaining}s` : 'Send a new code'}
      variant="secondary"
      disabled={remaining > 0}
      loading={loading}
      onPress={() => {
        setRemaining(COOLDOWN_SECONDS);
        onResend();
      }}
    />
  );
}
