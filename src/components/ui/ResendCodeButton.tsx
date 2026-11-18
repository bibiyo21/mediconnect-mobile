import { useEffect, useState } from 'react';
import { Button } from './Button';

const COOLDOWN_SECONDS = 60;

/**
 * "Send a new code" with a one-minute wait between requests, so codes are not
 * sent faster than people can receive them. The server's own limit is different:
 * 5 codes per email or mobile number every 15 minutes; past that the request gets
 * a 429 and the screen shows the rate-limit message.
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
