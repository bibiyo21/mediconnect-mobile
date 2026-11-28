import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, TextField } from '@/components/ui';
import { space } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';
import { parseBreakMinutes } from './format';

interface Props {
  /** The minutes pre-filled from a scheduled break that covers now, if any. */
  suggestedMinutes?: number;
  busy: boolean;
  disabled: boolean;
  /** A server refusal for this dialog's fields (for example the scheduled break is not at this clinic). */
  serverError?: string;
  onStart: (expectedMinutes: number) => void;
  onCancel: () => void;
}

/** Asks for the expected length of a break (1 to 240 minutes). The expected end is an estimate, not a promise. */
export function BreakDialog({ suggestedMinutes, busy, disabled, serverError, onStart, onCancel }: Props) {
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState(suggestedMinutes ? String(suggestedMinutes) : '');
  const [localError, setLocalError] = useState<string | undefined>();

  function submit() {
    const minutes = parseBreakMinutes(text);
    if (minutes === null) {
      setLocalError('Enter a whole number of minutes from 1 to 240.');
      return;
    }
    setLocalError(undefined);
    onStart(minutes);
  }

  return (
    <Card title="Start a break">
      <TextField
        label="Expected length in minutes"
        hint="1 to 240 minutes. The end time is an estimate, not a promise."
        keyboardType="number-pad"
        value={text}
        onChangeText={setText}
        error={serverError ?? localError}
        maxLength={3}
      />
      <View style={styles.row}>
        <Button label="Start break" onPress={submit} loading={busy} disabled={disabled} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
      </View>
    </Card>
  );
}

const createStyles = (_c: ThemeColors) => StyleSheet.create({ row: { gap: space[2] } });
