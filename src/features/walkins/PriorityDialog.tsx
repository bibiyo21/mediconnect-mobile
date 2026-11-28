import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, Card, ChoiceGroup } from '@/components/ui';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';
import { PRIORITY_REASON_LABELS } from './copy';
import type { PriorityLevelName, PriorityReasonCode } from './api';

const LEVELS: { value: PriorityLevelName; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'PRIORITY', label: 'Priority' },
  { value: 'URGENT', label: 'Urgent' },
];

const REASONS: { value: PriorityReasonCode; label: string }[] = (
  Object.keys(PRIORITY_REASON_LABELS) as PriorityReasonCode[]
).map((value) => ({ value, label: PRIORITY_REASON_LABELS[value] }));

interface Props {
  label: string;
  current: PriorityLevelName;
  busy: boolean;
  disabled: boolean;
  onSave: (level: PriorityLevelName, reason: PriorityReasonCode | null) => void;
  onCancel: () => void;
}

/**
 * Queue priority with a fixed reason code. There is no free-text field: the server stores codes only.
 * It orders the queue; it is not a clinical triage decision.
 */
export function PriorityDialog({ label, current, busy, disabled, onSave, onCancel }: Props) {
  const styles = useThemedStyles(createStyles);
  const [level, setLevel] = useState<PriorityLevelName>(current);
  const [reason, setReason] = useState<PriorityReasonCode | null>(null);
  const [error, setError] = useState<string | undefined>();

  function save() {
    if (level !== 'NORMAL' && !reason) {
      setError('Choose a reason for a priority above normal.');
      return;
    }
    setError(undefined);
    onSave(level, level === 'NORMAL' ? null : reason);
  }

  return (
    <Card title={`Priority for ${label}`}>
      <Text style={styles.note}>
        Priority changes the queue order. It is not a clinical triage decision. It does not change any appointment time.
      </Text>
      <ChoiceGroup label="Priority level" options={LEVELS} value={level} onChange={setLevel} />
      {level !== 'NORMAL' ? (
        <ChoiceGroup label="Reason (choose one)" options={REASONS} value={reason ?? ('' as PriorityReasonCode)} onChange={setReason} error={error} />
      ) : null}
      {level === 'NORMAL' && error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save priority" onPress={save} loading={busy} disabled={disabled} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
    </Card>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    note: { ...typography.small, color: c.textMuted, paddingBottom: space[2] },
    error: { ...typography.small, color: c.textPrimary, paddingTop: space[1] },
  });
